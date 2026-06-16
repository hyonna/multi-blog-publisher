import axios, { AxiosResponse } from 'axios'
import { Post } from '../store'

const ENDPOINT = 'https://v2.velog.io/graphql'

function makeHeaders(accessToken: string, refreshToken: string) {
  const cookies = [`access_token=${accessToken}`]
  if (refreshToken) cookies.push(`refresh_token=${refreshToken}`)
  return {
    'Content-Type': 'application/json',
    Cookie: cookies.join('; '),
    Origin: 'https://velog.io',
    Referer: 'https://velog.io/',
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  }
}

function makeSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^\w가-힣\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 80) + `-${Date.now().toString(36)}`
  )
}

async function gql(
  query: string,
  variables: Record<string, unknown>,
  headers: Record<string, string>,
  label: string
): Promise<AxiosResponse> {
  try {
    return await axios.post(ENDPOINT, { query, variables }, { headers })
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const body = err.response?.data
      const detail = body ? JSON.stringify(body) : err.message
      throw new Error(`[${label}] HTTP ${err.response?.status}: ${detail}`)
    }
    throw err
  }
}

// ── 알려진 mutation 후보들 ─────────────────────────────────────────────────
// Velog 스키마 변경 이력을 반영한 여러 시도
const MUTATION_CANDIDATES = [
  // v2 형식 (input wrapper)
  {
    label: 'v2/writePost-input',
    build: (slug: string) => ({
      query: `mutation WritePost($input: WritePostInput!) {
        writePost(input: $input) { id url_slug user { username } }
      }`,
      makeVars: (post: Post) => ({
        input: {
          title: post.title, body: post.content, tags: post.tags,
          is_markdown: true, is_temp: false, is_private: false, url_slug: slug,
        },
      }),
      dataKey: 'writePost',
    }),
  },
  // flat args 형식
  {
    label: 'v2/writePost-flat',
    build: (slug: string) => ({
      query: `mutation WritePost($title:String $body:String $tags:[String] $is_markdown:Boolean $is_temp:Boolean $is_private:Boolean $url_slug:String) {
        writePost(title:$title body:$body tags:$tags is_markdown:$is_markdown is_temp:$is_temp is_private:$is_private url_slug:$url_slug) {
          id url_slug user { username }
        }
      }`,
      makeVars: (post: Post) => ({
        title: post.title, body: post.content, tags: post.tags,
        is_markdown: true, is_temp: false, is_private: false, url_slug: slug,
      }),
      dataKey: 'writePost',
    }),
  },
  // createPost 형식
  {
    label: 'v2/createPost-input',
    build: (slug: string) => ({
      query: `mutation CreatePost($input: CreatePostInput!) {
        createPost(input: $input) { id url_slug user { username } }
      }`,
      makeVars: (post: Post) => ({
        input: {
          title: post.title, body: post.content, tags: post.tags,
          is_markdown: true, is_temp: false, is_private: false, url_slug: slug,
        },
      }),
      dataKey: 'createPost',
    }),
  },
]

export async function publishToVelog(
  post: Post,
  accessToken: string,
  refreshToken: string
): Promise<{ id: string; url: string }> {
  const headers = makeHeaders(accessToken, refreshToken)
  const slug = makeSlug(post.title)
  const errors: string[] = []

  // 0. 인증 확인
  try {
    const authRes = await gql(
      `{ currentUser { id username } }`,
      {},
      headers,
      'auth-check'
    )
    const me = authRes.data.data?.currentUser
    if (!me) {
      throw new Error(
        'access_token이 만료됐거나 유효하지 않습니다.\n설정에서 velog.io 쿠키를 다시 복사해 주세요.'
      )
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    // currentUser 쿼리 자체가 없는 경우(400)는 무시하고 발행 시도
    if (!msg.includes('HTTP 400')) throw e
  }

  // 1. 인트로스펙션으로 실제 스키마 파악 시도
  try {
    const introRes = await gql(
      `{ __schema { mutationType { fields { name args { name type { name ofType { name } } } } } } }`,
      {},
      headers,
      'introspection'
    )

    const fields: Array<{
      name: string
      args: Array<{ name: string; type: { name: string | null; ofType: { name: string } | null } }>
    }> = introRes.data.data?.__schema?.mutationType?.fields ?? []

    const candidates = ['writePost', 'createPost', 'write_post', 'create_post']
    const mutation = fields.find(f => candidates.includes(f.name))

    if (mutation) {
      const inputArg = mutation.args.find(a => a.name === 'input')
      const inputTypeName = inputArg?.type.name ?? inputArg?.type.ofType?.name ?? null

      const queryStr = inputTypeName
        ? `mutation P($input: ${inputTypeName}!) {
            ${mutation.name}(input: $input) { id url_slug user { username } }
          }`
        : `mutation P($title:String $body:String $tags:[String] $is_markdown:Boolean $is_temp:Boolean $is_private:Boolean $url_slug:String) {
            ${mutation.name}(title:$title body:$body tags:$tags is_markdown:$is_markdown is_temp:$is_temp is_private:$is_private url_slug:$url_slug) {
              id url_slug user { username }
            }
          }`

      const variables = inputTypeName
        ? { input: { title: post.title, body: post.content, tags: post.tags, is_markdown: true, is_temp: false, is_private: false, url_slug: slug } }
        : { title: post.title, body: post.content, tags: post.tags, is_markdown: true, is_temp: false, is_private: false, url_slug: slug }

      const res = await gql(queryStr, variables, headers, `introspected/${mutation.name}`)
      if (!res.data.errors?.length) {
        const wp = res.data.data?.[mutation.name]
        if (wp) return { id: wp.id, url: `https://velog.io/@${wp.user.username}/${wp.url_slug}` }
      }
      errors.push(`introspected: ${res.data.errors?.[0]?.message ?? '데이터 없음'}`)
    } else {
      errors.push(`introspection: 글쓰기 mutation 없음 (available: ${fields.map(f => f.name).join(', ')})`)
    }
  } catch (e: unknown) {
    errors.push(e instanceof Error ? e.message : String(e))
  }

  // 2. 알려진 mutation 형식들 순차 시도
  for (const candidate of MUTATION_CANDIDATES) {
    try {
      const { query, makeVars, dataKey } = candidate.build(slug)
      const res = await gql(query, makeVars(post), headers, candidate.label)

      if (res.data.errors?.length) {
        errors.push(`${candidate.label}: ${res.data.errors[0].message}`)
        continue
      }

      const wp = res.data.data?.[dataKey]
      if (wp) {
        return { id: wp.id, url: `https://velog.io/@${wp.user.username}/${wp.url_slug}` }
      }
      errors.push(`${candidate.label}: 응답 데이터 없음 (raw: ${JSON.stringify(res.data)})`)
    } catch (e: unknown) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
  }

  throw new Error(`Velog 발행 실패:\n${errors.join('\n')}`)
}

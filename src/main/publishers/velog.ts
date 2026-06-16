import axios from 'axios'
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
  }
}

function makeSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w가-힣\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80) + `-${Date.now().toString(36)}`
}

// 실제 스키마를 인트로스펙션으로 조회
async function introspectWritePost(
  headers: Record<string, string>
): Promise<{ mutationName: string; inputTypeName: string | null }> {
  const res = await axios.post(
    ENDPOINT,
    {
      query: `{
        __schema {
          mutationType {
            fields {
              name
              args { name type { name kind ofType { name kind } } }
            }
          }
        }
      }`
    },
    { headers }
  )

  type GqlArg = { name: string; type: { name: string | null; kind: string; ofType: { name: string } | null } }
  type GqlField = { name: string; args: GqlArg[] }

  const fields: GqlField[] = res.data.data?.__schema?.mutationType?.fields ?? []

  // writePost 또는 createPost 계열 mutation 탐색
  const candidates = ['writePost', 'createPost', 'write_post', 'create_post']
  const mutation = fields.find(f => candidates.includes(f.name))

  if (!mutation) {
    const names = fields.map(f => f.name).join(', ')
    throw new Error(`글쓰기 mutation을 찾을 수 없습니다. 사용 가능한 mutations: ${names}`)
  }

  const inputArg = mutation.args.find(a => a.name === 'input')
  const inputTypeName =
    inputArg?.type.name ??
    inputArg?.type.ofType?.name ??
    null

  return { mutationName: mutation.name, inputTypeName }
}

// 인트로스펙션으로 알아낸 InputType 필드 목록 조회
async function introspectInputFields(
  typeName: string,
  headers: Record<string, string>
): Promise<string[]> {
  const res = await axios.post(
    ENDPOINT,
    { query: `{ __type(name: "${typeName}") { inputFields { name } } }` },
    { headers }
  )
  return (res.data.data?.__type?.inputFields ?? []).map((f: { name: string }) => f.name)
}

const KNOWN_FIELDS = ['title', 'body', 'tags', 'is_markdown', 'is_temp', 'is_private', 'url_slug', 'series_id', 'thumbnail']

export async function publishToVelog(
  post: Post,
  accessToken: string,
  refreshToken: string
): Promise<{ id: string; url: string }> {
  const headers = makeHeaders(accessToken, refreshToken)

  // 1. 실제 mutation 이름과 InputType 이름 파악
  const { mutationName, inputTypeName } = await introspectWritePost(headers)

  // 2. InputType 필드 파악 (어떤 인수를 받는지)
  const allowedFields = inputTypeName
    ? await introspectInputFields(inputTypeName, headers)
    : KNOWN_FIELDS

  // 3. 허용된 필드만 포함한 input 구성
  const fullInput: Record<string, unknown> = {
    title: post.title,
    body: post.content,
    tags: post.tags,
    is_markdown: true,
    is_temp: false,
    is_private: false,
    url_slug: makeSlug(post.title),
  }
  const input = Object.fromEntries(
    Object.entries(fullInput).filter(([k]) => allowedFields.includes(k))
  )

  // 4. 동적으로 mutation 구성
  const mutation = inputTypeName
    ? `mutation WritePost($input: ${inputTypeName}!) {
        ${mutationName}(input: $input) { id url_slug user { username } }
      }`
    : `mutation WritePost($title: String, $body: String, $tags: [String], $is_markdown: Boolean, $is_temp: Boolean, $is_private: Boolean, $url_slug: String) {
        ${mutationName}(title: $title, body: $body, tags: $tags, is_markdown: $is_markdown, is_temp: $is_temp, is_private: $is_private, url_slug: $url_slug) {
          id url_slug user { username }
        }
      }`

  const variables = inputTypeName ? { input } : input

  const res = await axios.post(
    ENDPOINT,
    { query: mutation, variables },
    { headers }
  )

  if (res.data.errors?.length) {
    throw new Error(res.data.errors[0].message)
  }

  const wp = res.data.data?.[mutationName]
  if (!wp) throw new Error('발행 응답 데이터를 받지 못했습니다.')

  return {
    id: wp.id,
    url: `https://velog.io/@${wp.user.username}/${wp.url_slug}`,
  }
}

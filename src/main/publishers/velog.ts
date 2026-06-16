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
  headers: Record<string, string>
): Promise<AxiosResponse> {
  try {
    return await axios.post(ENDPOINT, { query, variables }, { headers })
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const body = err.response?.data
      throw new Error(`HTTP ${err.response?.status}: ${JSON.stringify(body ?? err.message)}`)
    }
    throw err
  }
}

// Step 1: 초안으로 글 생성
const WRITE_TEMP = `
  mutation WritePost(
    $title: String $body: String $tags: [String]
    $is_markdown: Boolean $is_temp: Boolean
  ) {
    writePost(
      title: $title body: $body tags: $tags
      is_markdown: $is_markdown is_temp: $is_temp
    ) {
      id url_slug user { username }
    }
  }
`

// Step 2: 초안을 발행 상태로 업데이트
const EDIT_POST = `
  mutation EditPost(
    $id: ID! $title: String $body: String $tags: [String]
    $is_markdown: Boolean $is_temp: Boolean $url_slug: String
  ) {
    editPost(
      id: $id title: $title body: $body tags: $tags
      is_markdown: $is_markdown is_temp: $is_temp url_slug: $url_slug
    ) {
      id url_slug user { username }
    }
  }
`

export async function publishToVelog(
  post: Post,
  accessToken: string,
  refreshToken: string
): Promise<{ id: string; url: string }> {
  const headers = makeHeaders(accessToken, refreshToken)
  const slug = makeSlug(post.title)

  // Step 1: 임시 초안 생성
  const writeRes = await gql(
    WRITE_TEMP,
    {
      title: post.title,
      body: post.content,
      tags: post.tags,
      is_markdown: true,
      is_temp: true,
    },
    headers
  )

  if (writeRes.data.errors?.length) {
    throw new Error(`초안 생성 실패: ${writeRes.data.errors[0].message}`)
  }

  const draft = writeRes.data.data?.writePost
  if (!draft) {
    // access_token 만료 가능성 안내
    throw new Error(
      '초안 생성 응답이 null입니다.\n' +
      'access_token이 만료(24시간)됐을 수 있습니다.\n' +
      'velog.io DevTools에서 access_token을 다시 복사해 설정에 붙여넣어 주세요.'
    )
  }

  // Step 2: 초안을 발행
  const editRes = await gql(
    EDIT_POST,
    {
      id: draft.id,
      title: post.title,
      body: post.content,
      tags: post.tags,
      is_markdown: true,
      is_temp: false,
      url_slug: slug,
    },
    headers
  )

  if (editRes.data.errors?.length) {
    throw new Error(`발행 실패: ${editRes.data.errors[0].message}`)
  }

  const published = editRes.data.data?.editPost ?? draft
  return {
    id: published.id,
    url: `https://velog.io/@${published.user.username}/${published.url_slug}`,
  }
}

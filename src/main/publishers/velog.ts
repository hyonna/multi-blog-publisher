import axios from 'axios'
import { Post } from '../store'

const ENDPOINTS = [
  'https://v3.velog.io/graphql',
  'https://v2.velog.io/graphql',
]

const WRITE_POST = `
  mutation WritePost($input: WritePostInput!) {
    writePost(input: $input) {
      id
      url_slug
      user { username }
    }
  }
`

function makeSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^\w가-힣\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
  return `${base}-${Date.now().toString(36)}`
}

function makeHeaders(accessToken: string) {
  return {
    'Content-Type': 'application/json',
    Cookie: `access_token=${accessToken}`,
    Authorization: `Bearer ${accessToken}`,
    Origin: 'https://velog.io',
    Referer: 'https://velog.io/',
  }
}

export async function publishToVelog(
  post: Post,
  accessToken: string
): Promise<{ id: string; url: string }> {
  const input = {
    title: post.title,
    body: post.content,
    tags: post.tags,
    is_markdown: true,
    is_temp: false,
    is_private: false,
    url_slug: makeSlug(post.title),
  }

  let lastError: Error = new Error('Velog API 연결 실패')

  for (const endpoint of ENDPOINTS) {
    try {
      const res = await axios.post(
        endpoint,
        { query: WRITE_POST, variables: { input } },
        { headers: makeHeaders(accessToken) }
      )

      if (res.data.errors?.length) {
        throw new Error(res.data.errors[0].message)
      }

      const wp = res.data.data?.writePost
      if (!wp) throw new Error('응답에서 writePost 데이터를 찾을 수 없습니다.')

      return {
        id: wp.id,
        url: `https://velog.io/@${wp.user.username}/${wp.url_slug}`,
      }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err))
      // 400/401이면 다음 엔드포인트 시도, 그 외는 즉시 throw
      const status = axios.isAxiosError(err) ? err.response?.status : null
      if (status && status !== 400 && status !== 401) throw lastError
    }
  }

  throw lastError
}

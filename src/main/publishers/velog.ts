import axios from 'axios'
import { Post } from '../store'

const ENDPOINT = 'https://v2.velog.io/graphql'

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

export async function publishToVelog(
  post: Post,
  accessToken: string,
  refreshToken: string
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

  let res
  try {
    res = await axios.post(
      ENDPOINT,
      { query: WRITE_POST, variables: { input } },
      { headers: makeHeaders(accessToken, refreshToken) }
    )
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const body = JSON.stringify(err.response?.data ?? '')
      throw new Error(`HTTP ${err.response?.status}: ${body || err.message}`)
    }
    throw err
  }

  if (res.data.errors?.length) {
    throw new Error(res.data.errors[0].message)
  }

  const wp = res.data.data?.writePost
  if (!wp) throw new Error('응답에서 writePost 데이터를 찾을 수 없습니다.')

  return {
    id: wp.id,
    url: `https://velog.io/@${wp.user.username}/${wp.url_slug}`,
  }
}

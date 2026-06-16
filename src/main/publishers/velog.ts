import { session } from 'electron'
import { Post } from '../store'

const ENDPOINT = 'https://v2.velog.io/graphql'
const PARTITION = 'persist:velog'

async function setupSession(accessToken: string, refreshToken: string): Promise<void> {
  const ses = session.fromPartition(PARTITION)

  const base = { url: 'https://velog.io', domain: '.velog.io', path: '/', secure: true }
  await ses.cookies.set({ ...base, name: 'access_token', value: accessToken })
  if (refreshToken) {
    await ses.cookies.set({ ...base, name: 'refresh_token', value: refreshToken })
  }
}

async function velogGql(query: string, variables: Record<string, unknown>): Promise<unknown> {
  const ses = session.fromPartition(PARTITION)

  const res = await ses.fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://velog.io',
      Referer: 'https://velog.io/',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }

  return res.json()
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

const WRITE_TEMP = `
  mutation WritePost($title:String $body:String $tags:[String] $is_markdown:Boolean $is_temp:Boolean) {
    writePost(title:$title body:$body tags:$tags is_markdown:$is_markdown is_temp:$is_temp) {
      id url_slug user { username }
    }
  }
`

const EDIT_POST = `
  mutation EditPost($id:ID! $title:String $body:String $tags:[String] $is_markdown:Boolean $is_temp:Boolean $url_slug:String) {
    editPost(id:$id title:$title body:$body tags:$tags is_markdown:$is_markdown is_temp:$is_temp url_slug:$url_slug) {
      id url_slug user { username }
    }
  }
`

export async function publishToVelog(
  post: Post,
  accessToken: string,
  refreshToken: string
): Promise<{ id: string; url: string }> {
  await setupSession(accessToken, refreshToken)

  // Step 1: 임시 초안 생성
  const writeData = (await velogGql(WRITE_TEMP, {
    title: post.title,
    body: post.content,
    tags: post.tags,
    is_markdown: true,
    is_temp: true,
  })) as { data?: { writePost?: { id: string; url_slug: string; user: { username: string } } }; errors?: { message: string }[] }

  if (writeData.errors?.length) {
    throw new Error(`초안 생성 실패: ${writeData.errors[0].message}`)
  }

  const draft = writeData.data?.writePost
  if (!draft) {
    throw new Error(
      '초안 생성 응답이 null입니다.\n' +
        'access_token이 만료됐거나 유효하지 않습니다.\n' +
        'velog.io DevTools → Cookies에서 access_token을 다시 복사해 주세요.'
    )
  }

  // Step 2: 발행
  const editData = (await velogGql(EDIT_POST, {
    id: draft.id,
    title: post.title,
    body: post.content,
    tags: post.tags,
    is_markdown: true,
    is_temp: false,
    url_slug: makeSlug(post.title),
  })) as { data?: { editPost?: { id: string; url_slug: string; user: { username: string } } }; errors?: { message: string }[] }

  if (editData.errors?.length) {
    throw new Error(`발행 실패: ${editData.errors[0].message}`)
  }

  const published = editData.data?.editPost ?? draft
  return {
    id: published.id,
    url: `https://velog.io/@${published.user.username}/${published.url_slug}`,
  }
}

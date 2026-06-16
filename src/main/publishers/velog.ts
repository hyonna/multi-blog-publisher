import axios from 'axios'
import { Post } from '../store'

const VELOG_GQL = 'https://v2.velog.io/graphql'

const WRITE_POST = `
  mutation WritePost($input: WritePostInput!) {
    writePost(input: $input) {
      id
      url_slug
      user { username }
    }
  }
`

const UPDATE_POST = `
  mutation EditPost($id: ID!, $input: EditPostInput!) {
    editPost(id: $id, input: $input) {
      id
      url_slug
      user { username }
    }
  }
`

function getHeaders(accessToken: string) {
  return {
    'Content-Type': 'application/json',
    Cookie: `access_token=${accessToken}; refresh_token=${accessToken}`
  }
}

export async function publishToVelog(
  post: Post,
  accessToken: string
): Promise<{ id: string; url: string }> {
  const res = await axios.post(
    VELOG_GQL,
    {
      query: WRITE_POST,
      variables: {
        input: {
          title: post.title,
          body: post.content,
          tags: post.tags,
          is_markdown: true,
          is_temp: false,
          is_private: false
        }
      }
    },
    { headers: getHeaders(accessToken) }
  )

  if (res.data.errors) {
    throw new Error(res.data.errors[0].message)
  }

  const wp = res.data.data.writePost
  return {
    id: wp.id,
    url: `https://velog.io/@${wp.user.username}/${wp.url_slug}`
  }
}

export async function updateVelogPost(
  post: Post,
  accessToken: string,
  velogId: string
): Promise<{ id: string; url: string }> {
  const res = await axios.post(
    VELOG_GQL,
    {
      query: UPDATE_POST,
      variables: {
        id: velogId,
        input: {
          title: post.title,
          body: post.content,
          tags: post.tags,
          is_markdown: true,
          is_private: false
        }
      }
    },
    { headers: getHeaders(accessToken) }
  )

  if (res.data.errors) {
    throw new Error(res.data.errors[0].message)
  }

  const ep = res.data.data.editPost
  return {
    id: ep.id,
    url: `https://velog.io/@${ep.user.username}/${ep.url_slug}`
  }
}

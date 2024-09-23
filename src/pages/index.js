import * as React from "react"
import { Link, graphql } from "gatsby"

import Bio from "../components/bio"
import Layout from "../components/layout"
import Seo from "../components/seo"

const BlogIndex = ({ data, location }) => {
  const siteTitle = data.site.siteMetadata?.title || `Title`
  const posts = data.allMarkdownRemark.nodes

  if (posts.length === 0) {
    return (
      <Layout location={location} title={siteTitle}>
        <p>
          No blog posts found. Add markdown posts to "content/blog" (or the
          directory you specified for the "gatsby-source-filesystem" plugin in
          gatsby-config.js).
        </p>
      </Layout>
    )
  }

  return (
    <Layout location={location} title={siteTitle}>
      <table>
        <tbody>
          {posts.map(post => {
            const title = post.frontmatter.title || post.fields.slug

            return (
              <article
                itemScope
                itemType="http://schema.org/Article"
                key={post.fields.slug}
              >
                <tr>
                  <td className='pr-4 text-[color:--color-text-light]'>
                    {post.frontmatter.date}
                  </td>
                  <td className='group'>
                    <Link to={post.fields.slug} itemProp="url">
                      <header>
                        <span itemProp="headline" className='text-xl'>{title}</span>
                      </header>
                      <section>
                        <p
                          dangerouslySetInnerHTML={{
                            __html: post.frontmatter.description || post.excerpt,
                          }}
                          itemProp="description"
                          className='mb-4'
                        />
                      </section>
                    </Link>
                  </td>
                </tr>
              </article>
            )
          })}
        </tbody>
      </table>
    </Layout>
  )
}

export default BlogIndex

/**
 * Head export to define metadata for the page
 *
 * See: https://www.gatsbyjs.com/docs/reference/built-in-components/gatsby-head/
 */
export const Head = () => <Seo title="All posts" />

export const pageQuery = graphql`
  {
    site {
      siteMetadata {
        title
      }
    }
    allMarkdownRemark(sort: { frontmatter: { date: DESC } }) {
      nodes {
        fields {
          slug
        }
        frontmatter {
          date(formatString: "YYYY-MM-DD")
          title
          description
        }
      }
    }
  }
`

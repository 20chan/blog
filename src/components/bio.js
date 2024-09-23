/**
 * Bio component that queries for data
 * with Gatsby's useStaticQuery component
 *
 * See: https://www.gatsbyjs.com/docs/how-to/querying-data/use-static-query/
 */

import * as React from "react"
import { useStaticQuery, Link, graphql } from "gatsby"
import { StaticImage } from "gatsby-plugin-image"

const Bio = () => {
  const data = useStaticQuery(graphql`
    query BioQuery {
      site {
        siteMetadata {
          author {
            name
            summary
          }
          social {
            twitter
          }
        }
      }
    }
  `)

  // Set these values by editing "siteMetadata" in gatsby-config.js
  const author = data.site.siteMetadata?.author
  const social = data.site.siteMetadata?.social

  return (
    <div>
      {author?.name && (
        <div>
          <div>
            Written by <strong>{author.name}</strong> {author?.summary || null}
          </div>
          <div>
            You can find me on
          {` `}
            <a href={`https://github.com/${social?.github || ``}`}>
              [GitHub]
            </a>
            , or
            {` `}
            <a href={`mailto:${social?.email || ``}`}>
              [Email]
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

export default Bio

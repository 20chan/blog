import * as React from "react"
import { Link, graphql } from "gatsby"
import Layout from '../components/layout'
import Seo from "../components/seo"

const About = ({ data, location }) => {
  const siteTitle = data.site.siteMetadata?.title || `Title`

  return (
    <Layout location={location} title={siteTitle}>
      <p className='font-bold text-3xl'>About</p>

      <p>
        오픈소스 아이돌이 되기 위해 인터넷에 흔적을 남깁니다.
        <br />
        낮에는 회사에서 일하는 평범한 직장인 프로그래머가 밤에는 오픈소스 아이돌?
      </p>

      <h3>
        Contact
      </h3>

      <p>
        연락은 이메일로 부탁드립니다. 팬레터는 언제나 환영입니다.

        <br />
        누적된 팬레터 수: 0
      </p>

      <ul>
        <li>
          <a href="mailto:2@0chan.dev">
            Email: <code className='language-text'>2@0chan.dev</code>
          </a>
        </li>
        <li>
          <a href="https://github.com/20chan">
            Github: <code className='language-text'>@20chan</code>
          </a>
        </li>
        <li>
          <a href="https://github.com/20chan/portfolio">
            Portfolio: <code className='language-text'>@20chan/portfolio</code>
          </a>
        </li>
        <li>
          <a href="https://0chan.dev/resume">
            Resume: <code className='language-text'>0chan.dev/resume</code>
          </a>
        </li>
        <li>
          <a href="https://0ch.me">
            Homepage: <code className='language-text'>0ch.me</code>
          </a>
        </li>
      </ul>

    </Layout>
  )
}

export default About;

export const Head = () => <Seo title="About" />

export const pageQuery = graphql`
  query {
    site {
      siteMetadata {
        title
      }
    }
  }
`
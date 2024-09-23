import * as React from "react"
import { Link } from "gatsby"

const Layout = ({ location, title, children }) => {
  const rootPath = `${__PATH_PREFIX__}/`
  const isRootPath = location.pathname === rootPath
  const header = (
    <h1 className="flex items-end font-bold text-4xl border-b-2 border-black">
      <Link to="/" className='pb-4'>{title}</Link>

      <div className='flex-1' />
      <Link to="/about" className='text-2xl pb-4'>About</Link>
    </h1>
  )

  return (
    <div className="global-wrapper" data-is-root-path={isRootPath}>
      <header className="">{header}</header>
      <main>{children}</main>
      <footer className='mt-2 text-[color:--color-text-light]'>
        ©20chan {new Date().getFullYear()}, Built with
        {` `}
        <a href="https://www.gatsbyjs.com">Gatsby</a>
      </footer>
    </div>
  )
}

export default Layout

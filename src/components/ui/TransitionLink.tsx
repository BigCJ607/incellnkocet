import React from 'react'
import { Link, useLocation } from 'react-router-dom'

interface TransitionLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string
  children: React.ReactNode
  variant?: 'standard' | 'eye' | 'slash'
}

export default function TransitionLink({ to, children, onClick, className, style, variant, ...rest }: TransitionLinkProps) {
  const location = useLocation()

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (onClick) onClick(e)
  }

  return (
    <Link to={to} onClick={handleClick} className={className} style={style} {...(rest as any)}>
      {children}
    </Link>
  )
}

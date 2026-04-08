import { forwardRef } from 'react'

const variantClasses = {
  primary: 'btn-neon',
  secondary: 'btn-outline-neon',
  ghost: 'btn-secondary',
}

const sizeClasses = {
  sm: 'py-2 px-4 text-sm',
  md: 'py-3 px-6 text-sm',
  lg: 'py-3.5 px-8 text-base',
}

const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    disabled = false,
    ...props
  },
  ref
) {
  const base = variantClasses[variant] ?? variantClasses.primary
  const sz = sizeClasses[size] ?? sizeClasses.md

  return (
    <button
      ref={ref}
      className={`${base} ${sz} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
})

export default Button

export default function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  className = '',
  children,
  ...props
}) {
  const variantClass = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    success: 'btn-success',
    danger: 'btn-danger',
  }[variant] ?? 'btn-primary'

  const sizeClass = {
    sm: 'py-2 px-4 text-sm',
    md: '',
    lg: 'py-4 px-8 text-lg',
  }[size] ?? ''

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {loading && (
        <span
          className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  )
}

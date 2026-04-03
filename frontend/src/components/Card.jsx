export default function Card({ children, className = '', hoverable = false }) {
  return (
    <div className={`${hoverable ? 'card-hover' : 'card'} ${className}`}>
      {children}
    </div>
  )
}

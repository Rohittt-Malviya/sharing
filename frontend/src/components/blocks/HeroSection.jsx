import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Upload, Shield, Zap, Lock } from 'lucide-react'
import BackgroundPaths from '../ui/BackgroundPaths'
import Button from '../ui/Button'

const SECURITY_BADGES = [
  { label: 'AES-256-GCM', icon: Lock },
  { label: 'WebRTC P2P',  icon: Zap },
  { label: 'Zero Storage', icon: Shield },
  { label: 'No Sign-up',  icon: ArrowRight },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.2 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

export default function HeroSection({ onSendFile }) {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const handleFileSelect = (file) => {
    if (!file) return
    const MAX = 2 * 1024 * 1024 * 1024
    if (file.size > MAX) return
    if (onSendFile) {
      onSendFile(file)
    } else {
      navigate('/send', { state: { file } })
    }
  }

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-20 pb-24 px-4">
      {/* ── Animated SVG background ── */}
      <BackgroundPaths />

      {/* ── Gradient overlay for contrast ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(0,217,255,0.06) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 70% 60%, rgba(157,78,221,0.07) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />

      {/* ── Content ── */}
      <motion.div
        className="relative z-10 max-w-4xl mx-auto text-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Pill badge */}
        <motion.div variants={itemVariants}>
          <span
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-sm font-medium"
            style={{
              background: 'rgba(0,217,255,0.08)',
              border: '1px solid rgba(0,217,255,0.2)',
              color: '#00D9FF',
            }}
          >
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            Blazing-fast P2P file sharing — no sign-up
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          variants={itemVariants}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight tracking-tight"
        >
          Share Files{' '}
          <span className="text-gradient-cyan">Seamlessly</span>
          <br />
          <span className="text-gradient-purple">&amp; Securely</span>
        </motion.h1>

        {/* Sub-text */}
        <motion.p
          variants={itemVariants}
          className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Transfer files peer-to-peer in real-time. No uploads, no cloud storage, no sign-up.
          End-to-end encrypted and completely private.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
        >
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <Button
              size="lg"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2.5 shadow-glow-cyan"
            >
              <Upload size={18} />
              Start Sending
              <ArrowRight size={16} className="ml-1" />
            </Button>
          </motion.div>

          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => navigate('/join')}
              className="flex items-center gap-2.5"
            >
              Receive a File
            </Button>
          </motion.div>
        </motion.div>

        {/* Security badges */}
        <motion.div
          variants={itemVariants}
          className="flex items-center justify-center gap-3 flex-wrap"
        >
          {SECURITY_BADGES.map(({ label, icon: Icon }) => (
            <span key={label} className="encryption-badge">
              <Icon size={13} />
              {label}
            </span>
          ))}
        </motion.div>
      </motion.div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files[0])}
        aria-hidden="true"
      />

      {/* Scroll cue */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 0.4, y: 0 }}
        transition={{ delay: 1.8, duration: 0.6 }}
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          className="w-6 h-10 rounded-full flex items-start justify-center pt-2"
          style={{ border: '1px solid rgba(255,255,255,0.15)' }}
        >
          <div className="w-1.5 h-3 rounded-full" style={{ background: 'rgba(0,217,255,0.6)' }} />
        </motion.div>
      </motion.div>
    </section>
  )
}

import { formatBytes, formatSpeed, formatEta } from '../utils/fileUtils'

export default function TransferProgress({ progress, speed, eta, fileName, fileSize }) {
  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      {/* File info */}
      {fileName && (
        <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/10">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-xl shrink-0">
            📄
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-white truncate">{fileName}</p>
            {fileSize && <p className="text-slate-400 text-sm">{formatBytes(fileSize)}</p>}
          </div>
        </div>
      )}

      {/* Progress */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-slate-400 text-sm">Progress</span>
          <span className="text-sky-300 font-bold tabular-nums">{progress}%</span>
        </div>
        <div className="progress-bar-track h-3">
          <div
            className="progress-bar-fill h-3"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="stat-box">
          <p className="text-slate-400 text-xs mb-1">Speed</p>
          <p className="text-white font-semibold text-sm tabular-nums">{formatSpeed(speed)}</p>
        </div>
        <div className="stat-box">
          <p className="text-slate-400 text-xs mb-1">ETA</p>
          <p className="text-white font-semibold text-sm tabular-nums">{formatEta(eta)}</p>
        </div>
      </div>
    </div>
  )
}


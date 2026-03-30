import { formatBytes, formatSpeed, formatEta } from '../utils/fileUtils'

export default function TransferProgress({ progress, speed, eta, fileName, fileSize }) {
  return (
    <div className="flex flex-col gap-4">
      {/* File name */}
      {fileName && (
        <div className="flex items-center gap-2">
          <span className="text-2xl">📄</span>
          <div>
            <p className="font-semibold text-white truncate max-w-xs">{fileName}</p>
            {fileSize && <p className="text-slate-400 text-sm">{formatBytes(fileSize)}</p>}
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-400">Progress</span>
          <span className="text-sky-400 font-semibold">{progress}%</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-700/60 rounded-xl p-3 text-center">
          <p className="text-slate-400 text-xs mb-1">Speed</p>
          <p className="text-white font-semibold text-sm">{formatSpeed(speed)}</p>
        </div>
        <div className="bg-slate-700/60 rounded-xl p-3 text-center">
          <p className="text-slate-400 text-xs mb-1">ETA</p>
          <p className="text-white font-semibold text-sm">{formatEta(eta)}</p>
        </div>
      </div>
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
import './App.css'

function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [capturing, setCapturing] = useState(false)
  const [captureInterval, setCaptureInterval] = useState(5) // seconds
  const [lastCapture, setLastCapture] = useState<string | null>(null)
  const [intervalId, setIntervalId] = useState<number | null>(null)
  const [status, setStatus] = useState('Ready')

  // Initialize webcam
  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 1280, height: 720 },
          audio: false
        })
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        
        setStatus('Camera ready')
      } catch (err) {
        console.error('Error accessing webcam:', err)
        setStatus('Camera error: ' + (err as Error).message)
      }
    }
    
    setupCamera()
    
    return () => {
      // Cleanup
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // Take a single picture
  const takePicture = async () => {
    if (!videoRef.current || !canvasRef.current) return
    
    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    
    if (!context) return
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    
    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    // Get image data as base64 string
    const imageData = canvas.toDataURL('image/jpeg', 0.9)
    setLastCapture(imageData)
    
    try {
      setStatus('Sending image...')
      const response = await fetch('http://localhost:3000/timelapse/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          image: imageData,
          timestamp: new Date().toISOString()
        }),
      })
      
      if (!response.ok) {
        throw new Error(`Server response: ${response.status}`)
      }
      
      setStatus('Image sent successfully')
    } catch (err) {
      console.error('Error sending image:', err)
      setStatus('Send error: ' + (err as Error).message)
    }
  }

  // Start/stop automatic capture
  const toggleCapture = () => {
    if (capturing) {
      // Stop capturing
      if (intervalId) {
        clearInterval(intervalId)
        setIntervalId(null)
      }
      setCapturing(false)
      setStatus('Capture stopped')
    } else {
      // Start capturing
      takePicture() // Take first picture immediately
      
      const id = window.setInterval(() => {
        takePicture()
      }, captureInterval * 1000)
      
      setIntervalId(id)
      setCapturing(true)
      setStatus('Capturing started')
    }
  }

  return (
    <div className="app-container">
      <h1>Timelapse Camera</h1>
      
      <div className="camera-container">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className="camera-feed"
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
      
      <div className="controls">
        <div className="status-bar">
          Status: {status}
        </div>
        
        <div className="control-row">
          <button 
            onClick={takePicture} 
            disabled={capturing}
            className="control-button"
          >
            Take Picture
          </button>
          
          <button 
            onClick={toggleCapture} 
            className={`control-button ${capturing ? 'stop' : 'start'}`}
          >
            {capturing ? 'Stop Capture' : 'Start Automatic Capture'}
          </button>
        </div>
        
        <div className="interval-control">
          <label htmlFor="interval">Capture Interval (seconds): </label>
          <input 
            id="interval"
            type="number" 
            min="1" 
            max="3600"
            value={captureInterval}
            onChange={(e) => setCaptureInterval(Number(e.target.value))}
            disabled={capturing}
          />
        </div>
      </div>
      
      {lastCapture && (
        <div className="last-capture">
          <h3>Last Captured Image</h3>
          <img src={lastCapture} alt="Last capture" className="thumbnail" />
          <p>Captured at: {new Date().toLocaleTimeString()}</p>
        </div>
      )}
    </div>
  )
}

export default App

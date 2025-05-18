import { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"

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
    <div className="flex flex-col items-center gap-6 max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-bold">Timelapse Camera</h1>
      
      <Card className="w-full">
        <CardContent className="p-0 overflow-hidden">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full"
          />
          <canvas ref={canvasRef} className="hidden" />
        </CardContent>
      </Card>
      
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg">Status: {status}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-4">
            <Button 
              variant="outline"
              onClick={takePicture} 
              disabled={capturing}
              className="flex-1"
            >
              Take Picture
            </Button>
            
            <Button 
              onClick={toggleCapture} 
              variant={capturing ? "destructive" : "default"}
              className="flex-1"
            >
              {capturing ? 'Stop Capture' : 'Start Automatic Capture'}
            </Button>
          </div>
          
          <div className="flex items-center gap-4">
            <label htmlFor="interval" className="min-w-40">Capture Interval (seconds): {captureInterval}</label>
            <Slider
              id="interval"
              disabled={capturing}
              min={1}
              max={60}
              step={1}
              value={[captureInterval]}
              onValueChange={(values) => setCaptureInterval(values[0])}
              className="flex-1"
            />
          </div>
        </CardContent>
      </Card>
      
      {lastCapture && (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-lg">Last Captured Image</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <img src={lastCapture} alt="Last capture" className="max-h-60 rounded-md" />
          </CardContent>
          <CardFooter>
            <p>Captured at: {new Date().toLocaleTimeString()}</p>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}

export default App

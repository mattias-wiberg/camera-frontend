import { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"

// Type for interval unit
type IntervalUnit = 'seconds' | 'minutes' | 'hours';

// Type for scheduled capture options
interface ScheduleOptions {
  daylightOnly: boolean;
  powerSaving: boolean;
  startTime: string;
  endTime: string;
}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [capturing, setCapturing] = useState(false)
  const capturingRef = useRef(false) // Use a ref to track capturing state for async operations
  
  // Enhanced interval settings
  const [intervalValue, setIntervalValue] = useState(5)
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>('seconds')
  const [actualIntervalMs, setActualIntervalMs] = useState(5000) // Actual interval in milliseconds
  
  // Capture scheduling options
  const [scheduleOptions, setScheduleOptions] = useState<ScheduleOptions>({
    daylightOnly: false,
    powerSaving: false,
    startTime: '08:00',
    endTime: '18:00'
  })
  
  const [lastCapture, setLastCapture] = useState<string | null>(null)
  const [intervalId, setIntervalId] = useState<number | null>(null)
  const [status, setStatus] = useState('Ready')
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null)

  // Calculate max values for different interval units
  const getMaxIntervalValue = (unit: IntervalUnit) => {
    switch (unit) {
      case 'seconds': return 60;
      case 'minutes': return 60;
      case 'hours': return 24;
      default: return 60;
    }
  }

  // Calculate interval in milliseconds based on value and unit
  useEffect(() => {
    let ms = intervalValue * 1000;
    if (intervalUnit === 'minutes') ms *= 60;
    if (intervalUnit === 'hours') ms *= 3600;
    setActualIntervalMs(ms);
  }, [intervalValue, intervalUnit]);

  // Keep capturingRef in sync with capturing state
  useEffect(() => {
    capturingRef.current = capturing;
  }, [capturing]);

  // Check if it's currently daylight based on schedule
  const isDaylight = (): boolean => {
    if (!scheduleOptions.daylightOnly) return true;
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHours, startMinutes] = scheduleOptions.startTime.split(':').map(Number);
    const [endHours, endMinutes] = scheduleOptions.endTime.split(':').map(Number);
    
    const startTimeMinutes = startHours * 60 + startMinutes;
    const endTimeMinutes = endHours * 60 + endMinutes;
    
    return currentTime >= startTimeMinutes && currentTime <= endTimeMinutes;
  };

  // Initialize webcam
  const setupCamera = async () => {
      // If there's an active stream already, don't create a new one
      if (activeStream && videoRef.current && videoRef.current.srcObject === activeStream) {
        console.log('Using existing camera stream');
        return activeStream;
      }

      // Clean up any existing stream first to prevent conflicts
      cleanupCamera();

      console.log('Requesting camera access...');
      setStatus('Initializing camera...');
      
      // Try with ideal settings first
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'environment' // Prefer rear camera if available
          },
          audio: false
        });
          
        if (videoRef.current) {
          console.log('Setting video source...');
          videoRef.current.srcObject = stream;
          setActiveStream(stream);
          
          // Return a promise that resolves when the video can play
          await new Promise<void>((resolve) => {
            if (!videoRef.current) {
              console.log('Video ref lost during setup');
              resolve();
              return;
            }
            
            const onCanPlay = () => {
              console.log('Video can play now');
              videoRef.current?.removeEventListener('canplay', onCanPlay);
              resolve();
            };
            
            if (videoRef.current && videoRef.current.readyState >= 3) { // HAVE_FUTURE_DATA = 3
              console.log('Video already ready');
              resolve();
            } else {
              console.log('Waiting for video to be ready...');
              videoRef.current?.addEventListener('canplay', onCanPlay);
              
              // Fallback timeout in case event never fires
              setTimeout(() => {
                console.log('Video ready timeout - continuing anyway');
                resolve();
              }, 5000);
            }
        });
      }
        
      setStatus('Camera ready');
      return stream;
    } catch (err) {
      console.error('Error accessing webcam:', err);
      setStatus('Camera error: ' + (err as Error).message);
      throw err; // Re-throw to allow proper error handling
    }
  };

  // Cleanup camera
  const cleanupCamera = () => {
    if (activeStream) {
      activeStream.getTracks().forEach(track => track.stop());
      setActiveStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setStatus('Camera powered down');
    }
  };

  // Initial camera setup
  useEffect(() => {
    if (!scheduleOptions.powerSaving) {
      setupCamera();
    }
    
    return () => {
      // Cleanup on component unmount
      cleanupCamera();
    };
  }, [scheduleOptions.powerSaving]);

  // Take a single picture
  const takePicture = async () => {
    // Check if we should capture based on daylight settings
    if (scheduleOptions.daylightOnly && !isDaylight()) {
      setStatus('Skipping capture: outside daylight hours');
      
      // If in power saving mode, ensure the camera is cleaned up
      if (scheduleOptions.powerSaving && activeStream) {
        cleanupCamera();
      }
      
      return false; // Return false to indicate capture was skipped
    }

    try {
      // If using power saving mode, setup camera before taking picture
      if (scheduleOptions.powerSaving) {
        if (!activeStream || !videoRef.current || videoRef.current.srcObject !== activeStream) {
          console.log('Camera initialization required in power saving mode');
          setStatus('Initializing camera for capture...');
          
          try {
            await setupCamera();
            
            // Wait for camera to initialize and stabilize
            console.log('Waiting for camera to stabilize...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Double-check if the stream is active and ready
            if (!activeStream || !videoRef.current || !videoRef.current.srcObject) {
              throw new Error('Camera failed to initialize properly');
            }
            
            // Ensure the video is actually playing and ready
            if (videoRef.current.readyState < 2) { // HAVE_CURRENT_DATA = 2
              console.log('Waiting for video to be ready...');
              await new Promise<void>(resolve => {
                const videoElement = videoRef.current;
                if (videoElement) {
                  const onLoadedData = () => {
                    videoElement.removeEventListener('loadeddata', onLoadedData);
                    resolve();
                  };
                  videoElement.addEventListener('loadeddata', onLoadedData);
                  
                  // Fallback timeout in case event never fires
                  setTimeout(resolve, 3000);
                } else {
                  resolve();
                }
              });
            }
            
            console.log('Camera ready with stream:', !!activeStream);
            setStatus('Camera ready for capture');
          } catch (err) {
            console.error('Camera initialization failed:', err);
            throw new Error('Failed to initialize camera: ' + (err as Error).message);
          }
        } else {
          console.log('Camera already active, using existing stream');
        }
      }

      if (!videoRef.current || !canvasRef.current) {
        throw new Error('Video or canvas reference not available');
      }
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error('Could not get canvas context');
      }
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get image data as base64 string
      const imageData = canvas.toDataURL('image/jpeg', 0.9);
      setLastCapture(imageData);
      
      setStatus('Sending image...');
      const response = await fetch('http://localhost:3000/timelapse/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          image: imageData,
          timestamp: new Date().toISOString()
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Server response: ${response.status}`);
      }
      
      setStatus('Image captured and sent successfully');
      return true; // Return true to indicate successful capture
    } catch (err) {
      console.error('Error in capture process:', err);
      setStatus('Capture error: ' + (err as Error).message);
      return false; // Return false to indicate failed capture
    } finally {
      // If in power saving mode, turn off camera after capture
      if (scheduleOptions.powerSaving && activeStream) {
        console.log('Cleaning up camera after capture');
        cleanupCamera();
      }
    }
  };

  // Start/stop automatic capture
  const toggleCapture = () => {
    if (capturing) {
      // Stop capturing
      if (intervalId) {
        clearTimeout(intervalId);
        setIntervalId(null);
      }
      setCapturing(false);
      capturingRef.current = false; // Update ref immediately
      setStatus('Capture stopped');
      
      // If in power saving mode, turn off camera when stopping
      if (scheduleOptions.powerSaving) {
        cleanupCamera();
      }
    } else {
      // Start capturing
      setCapturing(true);
      capturingRef.current = true; // Update ref immediately
      
      // Take first picture immediately
      takePicture();
      
      // Use setTimeout instead of setInterval to ensure each capture completes before starting the next one
      const scheduleNextCapture = () => {
        return window.setTimeout(async () => {
          // Use capturingRef instead of capturing to avoid closure issues
          if (capturingRef.current) {
            // Take picture and check if it was successful or skipped due to daylight settings
            const captureSuccess = await takePicture();
            
            // Only schedule the next capture if still capturing
            if (capturingRef.current) {
              // If we're in daylight-only mode and outside daylight hours,
              // check again in 1 minute rather than waiting for the full interval
              const nextCheckTime = (!captureSuccess && scheduleOptions.daylightOnly) 
                ? Math.min(60000, actualIntervalMs) // Check again in 1 minute or sooner
                : actualIntervalMs;                 // Regular interval
              
              console.log(`Scheduling next capture in ${nextCheckTime/1000} seconds`);
              const nextId = window.setTimeout(() => {
                if (capturingRef.current) {
                  const id = scheduleNextCapture();
                  setIntervalId(id);
                }
              }, nextCheckTime);
              
              setIntervalId(nextId);
            }
          }
        }, 100); // Small initial delay to ensure UI updates
      };
      
      const id = scheduleNextCapture();
      setIntervalId(id);
      setStatus('Capturing started');
    }
  };

  // Handle schedule option changes
  const handleScheduleOptionChange = (key: keyof ScheduleOptions, value: boolean | string) => {
    setScheduleOptions(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Format interval for display
  const formatIntervalDisplay = (): string => {
    if (intervalValue === 1) {
      // Singular form
      return `${intervalValue} ${intervalUnit.slice(0, -1)}`;
    }
    return `${intervalValue} ${intervalUnit}`;
  };

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
          
          <Tabs defaultValue="interval" className="w-full">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="interval">Interval Settings</TabsTrigger>
              <TabsTrigger value="schedule">Schedule & Power</TabsTrigger>
            </TabsList>
            
            <TabsContent value="interval" className="space-y-4">
              <div className="flex flex-col gap-4 py-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="interval-value" className="min-w-32">Capture every:</Label>
                  <div className="flex-1 flex items-center gap-2">
                    <Slider
                      id="interval-value"
                      disabled={capturing}
                      min={1}
                      max={getMaxIntervalValue(intervalUnit)}
                      step={1}
                      value={[intervalValue]}
                      onValueChange={(values) => setIntervalValue(values[0])}
                      className="flex-1"
                    />
                    <span className="w-8 text-right">{intervalValue}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Label htmlFor="interval-unit" className="min-w-32">Unit:</Label>
                  <Select
                    disabled={capturing}
                    value={intervalUnit}
                    onValueChange={(value: IntervalUnit) => setIntervalUnit(value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seconds">Seconds</SelectItem>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="pt-2 text-sm text-muted-foreground">
                  Current interval: {formatIntervalDisplay()}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="schedule" className="space-y-4">
              <div className="flex items-center space-x-2 py-2">
                <Switch
                  id="daylight-only"
                  disabled={capturing}
                  checked={scheduleOptions.daylightOnly}
                  onCheckedChange={(checked: boolean) => handleScheduleOptionChange('daylightOnly', checked)}
                />
                <Label htmlFor="daylight-only">Capture only during daylight hours</Label>
              </div>
              
              {scheduleOptions.daylightOnly && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="start-time">Start Time:</Label>
                    <Input
                      type="time"
                      id="start-time"
                      disabled={capturing}
                      value={scheduleOptions.startTime}
                      onChange={(e) => handleScheduleOptionChange('startTime', e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="end-time">End Time:</Label>
                    <Input
                      type="time"
                      id="end-time"
                      disabled={capturing}
                      value={scheduleOptions.endTime}
                      onChange={(e) => handleScheduleOptionChange('endTime', e.target.value)}
                    />
                  </div>
                </div>
              )}
              
              <div className="flex items-center space-x-2 py-2">
                <Switch
                  id="power-saving"
                  disabled={capturing}
                  checked={scheduleOptions.powerSaving}
                  onCheckedChange={(checked: boolean) => handleScheduleOptionChange('powerSaving', checked)}
                />
                <Label htmlFor="power-saving">Power saving mode (camera on only during capture)</Label>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p>Power saving mode turns the camera on only when taking pictures, reducing battery usage.</p>
                {scheduleOptions.daylightOnly && (
                  <p className="mt-2">Daylight capture will only take pictures between {scheduleOptions.startTime} and {scheduleOptions.endTime}.</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
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

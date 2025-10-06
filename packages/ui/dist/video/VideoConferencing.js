'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Monitor, MonitorOff, MessageCircle, Circle, Square, AlertTriangle, Shield, Clock, Wifi, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { VideoChat } from './VideoChat';
/**
 * Pure presentational video conferencing component
 * All state and business logic managed externally via props and callbacks
 */
export function VideoConferencing({ session, isConnected, isConnecting, localVideo, localAudio, localStream, remoteStream, screenStream, connectionQuality, sessionDuration, isRecording, isScreenSharing, isEncrypted, participants, error, localVideoRef, remoteVideoRef, screenShareRef, onToggleVideo, onToggleAudio, onStartScreenShare, onStopScreenShare, onStartRecording, onStopRecording, onEndSession, onError, participantInfo, }) {
    // Only UI state (not business logic)
    const [showChat, setShowChat] = useState(false);
    // Helper: Format session duration for display
    const formatDuration = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };
    // Helper: Get connection quality color class
    const getQualityColor = (quality) => {
        switch (quality) {
            case 'excellent': return 'text-green-600';
            case 'good': return 'text-yellow-600';
            case 'poor': return 'text-red-600';
            default: return 'text-gray-600';
        }
    };
    // Handler: Handle screen share toggle
    const handleScreenShareToggle = async () => {
        try {
            if (isScreenSharing) {
                onStopScreenShare();
            }
            else {
                await onStartScreenShare();
            }
        }
        catch (err) {
            if (onError) {
                onError({
                    code: 'SCREEN_SHARE_ERROR',
                    message: 'Failed to toggle screen sharing',
                    recoverable: true,
                });
            }
        }
    };
    // Handler: Handle recording toggle
    const handleRecordingToggle = async () => {
        try {
            if (isRecording) {
                await onStopRecording();
            }
            else {
                await onStartRecording();
            }
        }
        catch (err) {
            if (onError) {
                onError({
                    code: 'RECORDING_ERROR',
                    message: 'Failed to toggle recording',
                    recoverable: true,
                });
            }
        }
    };
    // Handler: Handle end session
    const handleEndSession = async () => {
        try {
            await onEndSession();
        }
        catch (err) {
            if (onError) {
                onError({
                    code: 'END_SESSION_ERROR',
                    message: 'Failed to end session',
                    recoverable: false,
                });
            }
        }
    };
    return (_jsxs("div", { className: "min-h-screen bg-gray-900 relative", role: "application", "aria-label": "Video conferencing application", children: [_jsx("div", { className: "absolute top-0 left-0 right-0 z-10 p-4", children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsxs("div", { className: "flex items-center gap-4", role: "region", "aria-label": "Session information", children: [_jsxs(Badge, { variant: "secondary", className: "bg-black/50 text-white", "aria-label": "HIPAA compliant session", children: [_jsx(Shield, { className: "w-4 h-4 mr-1", "aria-hidden": "true" }), "HIPAA Compliant"] }), isEncrypted && (_jsxs(Badge, { variant: "secondary", className: "bg-green-600/90 text-white", "aria-label": "End-to-end encrypted", children: [_jsx(Lock, { className: "w-4 h-4 mr-1", "aria-hidden": "true" }), "E2E Encrypted"] })), _jsxs(Badge, { variant: "secondary", className: "bg-black/50 text-white", "aria-label": `Session duration: ${formatDuration(sessionDuration)}`, children: [_jsx(Clock, { className: "w-4 h-4 mr-1", "aria-hidden": "true" }), formatDuration(sessionDuration)] }), _jsxs(Badge, { variant: "secondary", className: `bg-black/50 ${getQualityColor(connectionQuality)}`, "aria-label": `Connection quality: ${connectionQuality}`, children: [_jsx(Wifi, { className: "w-4 h-4 mr-1", "aria-hidden": "true" }), connectionQuality.charAt(0).toUpperCase() + connectionQuality.slice(1)] }), isRecording && (_jsxs(Badge, { variant: "destructive", className: "bg-red-600 text-white animate-pulse", "aria-label": "Recording in progress", children: [_jsx(Circle, { className: "w-4 h-4 mr-1", "aria-hidden": "true" }), "Recording (Encrypted)"] }))] }), _jsxs(Button, { variant: "destructive", size: "sm", onClick: handleEndSession, className: "bg-red-600 hover:bg-red-700", "aria-label": "End call", children: [_jsx(PhoneOff, { className: "w-4 h-4 mr-2", "aria-hidden": "true" }), "End Call"] })] }) }), error && (_jsx("div", { className: "absolute top-20 left-4 right-4 z-20", role: "alert", "aria-live": "assertive", children: _jsxs(Alert, { className: "bg-red-900/90 border-red-600 text-white", children: [_jsx(AlertTriangle, { className: "w-4 h-4", "aria-hidden": "true" }), _jsx(AlertDescription, { children: error.message })] }) })), _jsxs("div", { className: "flex h-screen", children: [_jsxs("div", { className: "flex-1 relative", role: "region", "aria-label": "Remote participant video", children: [_jsx("video", { ref: remoteVideoRef, autoPlay: true, playsInline: true, className: "w-full h-full object-cover bg-gray-800", "aria-label": "Remote participant video stream" }), isScreenSharing && (_jsx("video", { ref: screenShareRef, autoPlay: true, playsInline: true, className: "absolute inset-0 w-full h-full object-contain bg-black", "aria-label": "Shared screen content" })), isConnecting && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center bg-black/75", role: "status", "aria-live": "polite", children: _jsxs("div", { className: "text-center text-white", children: [_jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4", "aria-hidden": "true" }), _jsx("p", { children: "Connecting to video session..." })] }) }))] }), _jsxs("div", { className: "absolute bottom-20 right-4 w-64 h-48 bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-600", role: "region", "aria-label": "Your video preview", children: [_jsx("video", { ref: localVideoRef, autoPlay: true, playsInline: true, muted: true, className: "w-full h-full object-cover", "aria-label": "Your local video stream" }), !localVideo && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center bg-gray-800", children: _jsx(VideoOff, { className: "w-8 h-8 text-gray-400", "aria-hidden": "true" }) }))] })] }), _jsx("div", { className: "absolute bottom-0 left-0 right-0 p-4", role: "region", "aria-label": "Video call controls", children: _jsxs("div", { className: "flex justify-center items-center gap-4", children: [_jsx(Button, { variant: localAudio ? "secondary" : "destructive", size: "lg", onClick: onToggleAudio, className: "rounded-full w-12 h-12", "aria-label": localAudio ? "Mute microphone" : "Unmute microphone", "aria-pressed": localAudio, children: localAudio ? _jsx(Mic, { className: "w-6 h-6", "aria-hidden": "true" }) : _jsx(MicOff, { className: "w-6 h-6", "aria-hidden": "true" }) }), _jsx(Button, { variant: localVideo ? "secondary" : "destructive", size: "lg", onClick: onToggleVideo, className: "rounded-full w-12 h-12", "aria-label": localVideo ? "Turn off camera" : "Turn on camera", "aria-pressed": localVideo, children: localVideo ? _jsx(Video, { className: "w-6 h-6", "aria-hidden": "true" }) : _jsx(VideoOff, { className: "w-6 h-6", "aria-hidden": "true" }) }), _jsx(Button, { variant: isScreenSharing ? "default" : "secondary", size: "lg", onClick: handleScreenShareToggle, className: "rounded-full w-12 h-12", "aria-label": isScreenSharing ? "Stop screen sharing" : "Start screen sharing", "aria-pressed": isScreenSharing, children: isScreenSharing ? _jsx(MonitorOff, { className: "w-6 h-6", "aria-hidden": "true" }) : _jsx(Monitor, { className: "w-6 h-6", "aria-hidden": "true" }) }), participantInfo.role !== 'patient' && (_jsx(Button, { variant: isRecording ? "destructive" : "secondary", size: "lg", onClick: handleRecordingToggle, className: "rounded-full w-12 h-12", "aria-label": isRecording ? "Stop recording" : "Start recording", "aria-pressed": isRecording, children: isRecording ? _jsx(Square, { className: "w-6 h-6", "aria-hidden": "true" }) : _jsx(Circle, { className: "w-6 h-6", "aria-hidden": "true" }) })), _jsx(Button, { variant: showChat ? "default" : "secondary", size: "lg", onClick: () => setShowChat(!showChat), className: "rounded-full w-12 h-12", "aria-label": showChat ? "Hide chat" : "Show chat", "aria-pressed": showChat, children: _jsx(MessageCircle, { className: "w-6 h-6", "aria-hidden": "true" }) })] }) }), showChat && session && (_jsx("div", { className: "absolute right-4 top-20 bottom-20", role: "region", "aria-label": "Chat panel", children: _jsx(VideoChat, { sessionId: session.sessionId, currentUser: participantInfo, isVisible: showChat, onClose: () => setShowChat(false) }) }))] }));
}

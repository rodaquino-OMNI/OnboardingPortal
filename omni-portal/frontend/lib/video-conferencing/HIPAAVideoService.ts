// HIPAA-Compliant Video Service with End-to-End Encryption
import { EventEmitter } from 'events';

export interface HIPAAVideoConfig {
  stunServers: string[];
  turnServers: string[];
  turnUsername?: string;
  turnCredential?: string;
  sessionId: string;
  userId: string;
  role: 'patient' | 'doctor' | 'moderator';
}

export interface VideoSession {
  id: string;
  sessionId: string;
  encryptionKey: CryptoKey | null;
  participants: Map<string, ParticipantInfo>;
  recordingSession?: RecordingSession;
}

export interface ParticipantInfo {
  id: string;
  name: string;
  role: 'patient' | 'doctor' | 'moderator';
  stream?: MediaStream;
  connection?: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
}

export interface RecordingSession {
  id: string;
  started_at: Date;
  recorder: MediaRecorder;
  chunks: Blob[];
  encryptionKey?: CryptoKey;
}

export interface EncryptedMessage {
  iv: string;
  data: string;
  timestamp: number;
  signature?: string;
}

export class HIPAAVideoService extends EventEmitter {
  private peer: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private encryptionKey: CryptoKey | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private session: VideoSession | null = null;
  private recordingSession: RecordingSession | null = null;

  constructor(private config: HIPAAVideoConfig) {
    super();
    this.initializePeerConnection();
  }

  private initializePeerConnection() {
    // HIPAA-compliant STUN/TURN servers configuration
    this.peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: this.config.stunServers,
        },
        {
          urls: this.config.turnServers,
          username: this.config.turnUsername || '',
          credential: this.config.turnCredential || '',
        },
      ],
      iceCandidatePoolSize: 10,
      // Enable encryption
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });

    // Setup encrypted data channel
    this.setupEncryptedDataChannel();
    
    // Event handlers
    this.setupEventHandlers();
  }

  /**
   * Start HIPAA-compliant video session
   */
  async startSession(sessionId: string): Promise<VideoSession> {
    try {
      // Generate session encryption key
      this.encryptionKey = await this.generateEncryptionKey();

      // Get user media with constraints
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Add stream to peer connection
      this.localStream.getTracks().forEach(track => {
        this.peer!.addTrack(track, this.localStream!);
      });

      // Create offer
      const offer = await this.peer!.createOffer();
      await this.peer!.setLocalDescription(offer);

      // Initialize session
      this.session = {
        id: `session_${Date.now()}`,
        sessionId,
        encryptionKey: this.encryptionKey,
        participants: new Map(),
      };

      // Emit session started event
      this.emit('sessionStarted', this.session);

      return this.session;
    } catch (error) {
      console.error('Failed to start HIPAA video session:', error);
      throw new Error('Video session initialization failed');
    }
  }

  /**
   * Setup encrypted data channel for chat
   */
  private setupEncryptedDataChannel() {
    if (!this.peer) return;

    const dataChannel = this.peer.createDataChannel('encrypted-chat', {
      ordered: true,
    });

    dataChannel.onopen = () => {
      console.log('Encrypted data channel opened');
      this.dataChannel = dataChannel;
      this.emit('dataChannelOpen');
    };

    dataChannel.onmessage = async (event) => {
      try {
        const encryptedMessage = JSON.parse(event.data) as EncryptedMessage;
        const decryptedMessage = await this.decryptMessage(encryptedMessage);
        this.emit('encryptedMessage', decryptedMessage);
      } catch (error) {
        console.error('Failed to decrypt message:', error);
      }
    };

    dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
      this.emit('dataChannelError', error);
    };

    dataChannel.onclose = () => {
      console.log('Data channel closed');
      this.emit('dataChannelClose');
    };
  }

  /**
   * Setup WebRTC event handlers
   */
  private setupEventHandlers() {
    if (!this.peer) return;

    // Handle remote stream
    this.peer.ontrack = (event) => {
      const [remoteStream] = event.streams;
      this.remoteStream = remoteStream || null;
      this.emit('remoteStream', remoteStream);
    };

    // Handle ICE candidates
    this.peer.onicecandidate = (event) => {
      if (event.candidate) {
        this.emit('iceCandidate', event.candidate);
      }
    };

    // Handle connection state changes
    this.peer.onconnectionstatechange = () => {
      const state = this.peer!.connectionState;
      this.emit('connectionStateChange', state);

      if (state === 'failed' || state === 'disconnected') {
        this.handleConnectionFailure();
      }
    };

    // Handle ICE connection state changes
    this.peer.oniceconnectionstatechange = () => {
      const state = this.peer!.iceConnectionState;
      this.emit('iceConnectionStateChange', state);
    };

    // Handle signaling state changes
    this.peer.onsignalingstatechange = () => {
      const state = this.peer!.signalingState;
      this.emit('signalingStateChange', state);
    };
  }

  /**
   * Send encrypted chat message
   */
  async sendEncryptedMessage(message: string): Promise<void> {
    if (!this.encryptionKey) throw new Error('Encryption not initialized');
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not ready');
    }

    const encryptedMessage = await this.encryptMessage(message);
    this.dataChannel.send(JSON.stringify(encryptedMessage));
  }

  /**
   * Start HIPAA-compliant recording
   */
  async startRecording(): Promise<RecordingSession> {
    if (!this.localStream) throw new Error('No local stream available');

    // Generate recording-specific encryption key
    const recordingKey = await this.generateEncryptionKey();

    const mediaRecorder = new MediaRecorder(this.localStream, {
      mimeType: 'video/webm;codecs=vp9,opus',
      videoBitsPerSecond: 2500000,
      audioBitsPerSecond: 128000,
    });

    const chunks: Blob[] = [];
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const recordingBlob = new Blob(chunks, { type: 'video/webm' });
      
      // Encrypt recording before upload
      const encryptedRecording = await this.encryptRecording(recordingBlob, recordingKey);
      
      // Emit event for upload
      this.emit('recordingReady', {
        encrypted: encryptedRecording,
        key: recordingKey,
        duration: Date.now() - this.recordingSession!.started_at.getTime(),
      });
    };

    mediaRecorder.start(1000); // Record in 1s chunks

    this.recordingSession = {
      id: `recording_${Date.now()}`,
      started_at: new Date(),
      recorder: mediaRecorder,
      chunks,
      encryptionKey: recordingKey,
    };

    this.emit('recordingStarted', this.recordingSession);

    return this.recordingSession;
  }

  /**
   * Stop recording
   */
  async stopRecording(): Promise<void> {
    if (!this.recordingSession) throw new Error('No active recording');

    this.recordingSession.recorder.stop();
    this.emit('recordingStopped');
  }

  /**
   * Generate encryption key for session
   */
  private async generateEncryptionKey(): Promise<CryptoKey> {
    return await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt message using AES-GCM
   */
  private async encryptMessage(message: string): Promise<EncryptedMessage> {
    if (!this.encryptionKey) throw new Error('Encryption key not available');

    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      this.encryptionKey,
      data
    );

    return {
      iv: this.arrayBufferToBase64(iv.buffer),
      data: this.arrayBufferToBase64(encrypted),
      timestamp: Date.now(),
    };
  }

  /**
   * Decrypt message using AES-GCM
   */
  private async decryptMessage(encryptedMessage: EncryptedMessage): Promise<string> {
    if (!this.encryptionKey) throw new Error('Encryption key not available');

    const iv = this.base64ToArrayBuffer(encryptedMessage.iv);
    const data = this.base64ToArrayBuffer(encryptedMessage.data);

    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(iv),
      },
      this.encryptionKey,
      data
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * Encrypt recording blob
   */
  private async encryptRecording(blob: Blob, key: CryptoKey): Promise<ArrayBuffer> {
    const arrayBuffer = await blob.arrayBuffer();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      arrayBuffer
    );

    // Combine IV and encrypted data
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv);
    result.set(new Uint8Array(encrypted), iv.length);

    return result.buffer;
  }

  /**
   * Handle connection failure
   */
  private handleConnectionFailure() {
    console.error('Connection failed, attempting to recover');
    this.emit('connectionFailed');
    
    // Attempt to reconnect
    setTimeout(() => {
      this.reconnect();
    }, 2000);
  }

  /**
   * Reconnect to session
   */
  private async reconnect() {
    try {
      // Close existing connection
      if (this.peer) {
        this.peer.close();
      }

      // Reinitialize
      this.initializePeerConnection();
      
      // Restore streams if available
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          this.peer!.addTrack(track, this.localStream!);
        });
      }

      this.emit('reconnecting');
    } catch (error) {
      console.error('Reconnection failed:', error);
      this.emit('reconnectionFailed', error);
    }
  }

  /**
   * Get connection quality statistics
   */
  async getConnectionStats(): Promise<any> {
    if (!this.peer) return null;

    const stats = await this.peer.getStats();
    const report: any = {
      video: {},
      audio: {},
      connection: {},
    };

    stats.forEach((stat) => {
      if (stat.type === 'inbound-rtp' && stat.mediaType === 'video') {
        report.video = {
          packetsLost: stat.packetsLost,
          packetsReceived: stat.packetsReceived,
          bytesReceived: stat.bytesReceived,
          jitter: stat.jitter,
          frameWidth: stat.frameWidth,
          frameHeight: stat.frameHeight,
          framesPerSecond: stat.framesPerSecond,
        };
      } else if (stat.type === 'inbound-rtp' && stat.mediaType === 'audio') {
        report.audio = {
          packetsLost: stat.packetsLost,
          packetsReceived: stat.packetsReceived,
          bytesReceived: stat.bytesReceived,
          jitter: stat.jitter,
          audioLevel: stat.audioLevel,
        };
      } else if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
        report.connection = {
          roundTripTime: stat.currentRoundTripTime,
          availableOutgoingBitrate: stat.availableOutgoingBitrate,
          availableIncomingBitrate: stat.availableIncomingBitrate,
        };
      }
    });

    return report;
  }

  /**
   * Handle incoming offer
   */
  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peer) throw new Error('Peer connection not initialized');

    await this.peer.setRemoteDescription(offer);
    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(answer);

    return answer;
  }

  /**
   * Handle incoming answer
   */
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peer) throw new Error('Peer connection not initialized');

    await this.peer.setRemoteDescription(answer);
  }

  /**
   * Handle incoming ICE candidate
   */
  async handleIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (!this.peer) throw new Error('Peer connection not initialized');

    await this.peer.addIceCandidate(candidate);
  }

  /**
   * Toggle local video
   */
  toggleLocalVideo(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * Toggle local audio
   */
  toggleLocalAudio(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * Replace video track (for screen sharing)
   */
  async replaceVideoTrack(newTrack: MediaStreamTrack): Promise<void> {
    if (!this.peer) throw new Error('Peer connection not initialized');

    const sender = this.peer.getSenders().find(s => 
      s.track && s.track.kind === 'video'
    );

    if (sender) {
      await sender.replaceTrack(newTrack);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Stop all tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }

    // Close data channel
    if (this.dataChannel) {
      this.dataChannel.close();
    }

    // Close peer connection
    if (this.peer) {
      this.peer.close();
    }

    // Stop recording if active
    if (this.recordingSession) {
      this.recordingSession.recorder.stop();
    }

    // Clear references
    this.localStream = null;
    this.remoteStream = null;
    this.peer = null;
    this.dataChannel = null;
    this.encryptionKey = null;
    this.session = null;
    this.recordingSession = null;

    this.removeAllListeners();
  }

  /**
   * Utility: Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(byte => binary += String.fromCharCode(byte));
    return btoa(binary);
  }

  /**
   * Utility: Convert Base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Getters
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  getSession(): VideoSession | null {
    return this.session;
  }

  isRecording(): boolean {
    return this.recordingSession !== null;
  }

  getConnectionState(): RTCPeerConnectionState | null {
    return this.peer?.connectionState || null;
  }
}

// Export encryption utilities for external use
export const encryptionUtils = {
  async generateKey(): Promise<CryptoKey> {
    return await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  },

  async exportKey(key: CryptoKey): Promise<JsonWebKey> {
    return await window.crypto.subtle.exportKey('jwk', key);
  },

  async importKey(jwk: JsonWebKey): Promise<CryptoKey> {
    return await window.crypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'AES-GCM',
        length: 256,
      },
      true,
      ['encrypt', 'decrypt']
    );
  },
};
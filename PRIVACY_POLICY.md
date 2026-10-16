# Privacy Policy for PhoneLink Remote

**Last Updated:** October 2026

PhoneLink Remote ("the Application") is an authorized private utility designed for screen-sharing and remote device control.

### 1. Accessibility Service API Usage
PhoneLink Remote requires the use of Android's `AccessibilityService` API strictly to execute remote input gestures (such as taps and clicks) transmitted during an active, user-authorized connection.
- **No Data Harvesting:** The service does not inspect, read, intercept, or store on-screen text, passwords, messages, or keyboard input.
- **Restricted Window Access:** The app explicitly sets `canRetrieveWindowContent="false"`.

### 2. Screen Capture (MediaProjection API)
The Application utilizes Android's screen capture mechanism exclusively to encode and stream visual frames via WebRTC during an active session initiated by the device owner. Streaming immediately stops when the foreground service is terminated.

### 3. Data Collection, Storage, and Sharing
- **No Personal Data Collected:** The Application does not collect, record, track, or share personal identifiable information (PII).
- **Transient Signaling:** All signaling data routed via the relay server is transient and strictly used to establish peer-to-peer (P2P) connections.

### 4. Contact
For any queries or concerns regarding this privacy policy, please contact the developer via Gmail
Gmail:- narsivaishnav11@gmail.com

# PacketPanda A Peer-to-Peer File Sharing Application

PacketPanda is a free, open-source web service that allows users to share files directly between their browsers using peer-to-peer technology in real-time using a secure and scalable WebRTC-based connection. The PacketPanda is hosted on Railway and supports both development and production environments.

## Features

- **Real-time File Sharing**: Allows users to send and receive files with other peers instantly.
- **Secure Peer-to-Peer Connections**: Uses WebRTC (via PeerJS) for secure, direct communication between peers.
- **Token-Based Authentication**: Generate tokens to securely identify peers and establish connections.
- **Cross-Origin Resource Sharing (CORS)**: The server is configured to allow connections from different origins, making it usable with various frontend applications.

## Project Overview

Users can share files by dragging and dropping them onto the FilePizza site, or by selecting a file. The site then generates a unique URL that can be shared with recipients. When recipients click the link, their browser connects directly to the sender's browser to download the file.

- Your file is not gonna stored anywhere on the server
- Works across platforms
- No file size limits
- No need to create an account

### Technologies Used

- **Node.js**: JavaScript runtime for building the server-side logic.
- **Express**: Web application framework for Node.js.
- **Socket.IO**: A library for real-time, bi-directional communication between clients and servers.
- **PeerJS**: A library that simplifies WebRTC, providing real-time peer-to-peer data and media sharing.
- **HTML/CSS/JavaScript**: For building the frontend pages (sender and receiver).

## Deployment

This project is deployed on Railway and can be accessed via the following domain:

- **Production URL**: [https://packetpanda.shouttocode.com](https://packetpanda.shouttocode.com)

## Contribution

We welcome contributions to improve this project. Feel free to fork this repository, open issues, and submit pull requests.

## License

This project is licensed under the MIT License.


## Author

- **Ashis Srivastava**
  - GitHub: [Ashish Srivastava](https://github.com/shouttolearnorg)
  - LinkedIn: [Ashish Srivastava](https://www.linkedin.com/in/text-ashish/)

---

Made with ❤️. Enjoy signing digitally!

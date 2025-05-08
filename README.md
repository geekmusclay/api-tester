# API Tester

A Postman-like API testing application

## Features

- Collections
- Requests
- Headers
- Body
- Response
- Save requests
- Edit collection names
- Import collections from API
- Dark mode
- Responsive design

## Installation

```bash
npm install
```

## Usage

```bash
npm run start
```
or
```bash
node server.js
```

## API Import Format

To import collections from an API, the endpoint must return an array of objects in the following format:

```json
[
  {
    "name": "Request Name",
    "method": "GET",
    "url": "https://api.example.com/endpoint",
    "headers": {
      "Content-Type": "application/json",
      "Authorization": "Bearer token"
    },
    "body": "{\"key\": \"value\"}"
  }
]
```

## License

MIT

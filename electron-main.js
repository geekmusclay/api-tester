const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');

// Keep a global reference of the window object
let mainWindow;
let serverProcess;
const SERVER_PORT = 3000;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        icon: path.join(__dirname, 'assets', 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            webSecurity: true
        },
        show: false, // Don't show until ready
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
    });

    // Start the Express server
    startServer().then(() => {
        // Load the app
        mainWindow.loadURL(SERVER_URL);
        
        // Show window when ready to prevent visual flash
        mainWindow.once('ready-to-show', () => {
            mainWindow.show();
            
            // Focus on window
            if (process.platform === 'darwin') {
                app.dock.show();
            }
        });
    }).catch(err => {
        console.error('Failed to start server:', err);
        dialog.showErrorBox('Server Error', 'Failed to start the application server.');
        app.quit();
    });

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Create application menu
    createMenu();
}

function startServer() {
    return new Promise((resolve, reject) => {
        // Check if server is already running
        axios.get(SERVER_URL)
            .then(() => {
                console.log('Server already running');
                resolve();
            })
            .catch(() => {
                // Start the server
                console.log('Starting server...');
                serverProcess = spawn('node', ['server.js'], {
                    cwd: __dirname,
                    stdio: 'pipe'
                });

                serverProcess.stdout.on('data', (data) => {
                    console.log(`Server: ${data}`);
                });

                serverProcess.stderr.on('data', (data) => {
                    console.error(`Server Error: ${data}`);
                });

                serverProcess.on('error', (err) => {
                    console.error('Failed to start server:', err);
                    reject(err);
                });

                // Wait for server to be ready
                const checkServer = () => {
                    axios.get(SERVER_URL)
                        .then(() => {
                            console.log('Server is ready');
                            resolve();
                        })
                        .catch(() => {
                            setTimeout(checkServer, 500);
                        });
                };

                setTimeout(checkServer, 1000);
            });
    });
}

function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Request',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        mainWindow.webContents.executeJavaScript(`
                            document.getElementById('url').focus();
                        `);
                    }
                },
                {
                    label: 'Save Request',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => {
                        mainWindow.webContents.executeJavaScript(`
                            document.getElementById('save-request').click();
                        `);
                    }
                },
                { type: 'separator' },
                {
                    label: 'Export Collections',
                    click: () => {
                        mainWindow.webContents.executeJavaScript(`
                            document.getElementById('export-collections').click();
                        `);
                    }
                },
                {
                    label: 'Import Collections',
                    click: () => {
                        mainWindow.webContents.executeJavaScript(`
                            document.getElementById('import-file').click();
                        `);
                    }
                },
                { type: 'separator' },
                {
                    label: 'Exit',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectall' }
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Toggle Sidebar',
                    accelerator: 'CmdOrCtrl+B',
                    click: () => {
                        mainWindow.webContents.executeJavaScript(`
                            document.getElementById('sidebarToggle').click();
                        `);
                    }
                },
                {
                    label: 'Toggle Dark Mode',
                    accelerator: 'CmdOrCtrl+D',
                    click: () => {
                        mainWindow.webContents.executeJavaScript(`
                            document.getElementById('darkModeToggle').click();
                        `);
                    }
                },
                { type: 'separator' },
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'close' }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About API Tester',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'About API Tester',
                            message: 'API Tester',
                            detail: 'A Postman-like API testing application built with Electron.\n\nVersion: 1.0.0'
                        });
                    }
                }
            ]
        }
    ];

    // macOS specific menu adjustments
    if (process.platform === 'darwin') {
        template.unshift({
            label: app.getName(),
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        });

        // Window menu
        template[4].submenu = [
            { role: 'close' },
            { role: 'minimize' },
            { role: 'zoom' },
            { type: 'separator' },
            { role: 'front' }
        ];
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// Disable GPU acceleration to prevent crashes on some Windows systems
app.disableHardwareAcceleration();

// App event handlers
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // Kill server process
    if (serverProcess) {
        serverProcess.kill();
    }
    
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    // Kill server process
    if (serverProcess) {
        serverProcess.kill();
    }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
    contents.on('new-window', (event, navigationUrl) => {
        event.preventDefault();
        shell.openExternal(navigationUrl);
    });
});

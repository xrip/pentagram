// Pentagram.foo - Main Application Entry Point

// Components
import './components/pentagram-app.js'
import './components/connection-status.js'
import './components/voice-controls.js'

console.log('Main application script loaded')

// Service Worker registration (for PWA)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js')
            console.log('SW registered: ', registration)
        } catch (registrationError) {
            console.log('SW registration failed: ', registrationError)
        }
    })
}

// Dynamically load and initialize Alpine.js
import Alpine from 'alpinejs'
import persist from '@alpinejs/persist'

Alpine.plugin(persist)
window.Alpine = Alpine
Alpine.start()

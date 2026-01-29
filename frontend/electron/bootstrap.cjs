(async () => {
      try {
            // Dynamically import the ESM main to satisfy Electron's CommonJS loader
            await import('./main.js');
      } catch (err) {
            console.error('Failed to load ESM main:', err);
            process.exit(1);
      }
})();

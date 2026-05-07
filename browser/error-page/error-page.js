const params = new URLSearchParams(location.search);
    const target = params.get('url') || 'Unknown';
    const reason = params.get('reason') || 'The page failed to load.';
    document.getElementById('target').textContent = target;
    document.getElementById('reason').textContent = reason;

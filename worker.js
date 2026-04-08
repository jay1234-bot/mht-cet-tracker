// Background timer worker - keeps running even when tab is hidden
let interval = null;
let seconds = 0;

self.onmessage = function(e) {
  if (e.data === 'start') {
    interval = setInterval(() => {
      seconds++;
      self.postMessage({ type: 'tick', seconds });
    }, 1000);
  } else if (e.data === 'pause' || e.data === 'stop') {
    clearInterval(interval);
    interval = null;
    if (e.data === 'stop') seconds = 0;
  } else if (e.data === 'resume') {
    interval = setInterval(() => {
      seconds++;
      self.postMessage({ type: 'tick', seconds });
    }, 1000);
  } else if (typeof e.data === 'object' && e.data.type === 'set') {
    seconds = e.data.seconds;
  }
};

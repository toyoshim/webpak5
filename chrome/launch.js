chrome.app.runtime.onLaunched.addListener(function(data) {
  chrome.app.window.create('ui.html', {
    resizable: false,
    bounds: {
      'width': 480,
      'height': 460 
    }
  }, function (window) {
    if (data.items)
      window.contentWindow._openFile = data.items[0];
  }.bind(data));
});

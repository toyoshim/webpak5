player = new Mp3Player();

pitch = 1;
speed = 1;

lastDuration = 0;
loading = false;

markerContext = null;
markerWidth = 0;
markerHeight = 0;
markerDrag = false;

log = function (message) {
    $('#log').text(message);
    setTimeout(function () {
        $('#log').text('　');
    }, 1000);
};

fileOpenDialog = function (q) {
    if (loading)
        return;
    $('#file').click();
};

drawMarkers = function () {
    var width = markerWidth - 1;
    var start = (player.startDuration() * width)|0;
    var end = (player.endDuration() * width)|0;
    markerContext.clearRect(0, 0, markerWidth, markerHeight);
    if (start == end) {
        markerContext.fillStyle = 'rgb(255, 255, 0)';
        markerContext.fillRect(start, 0, 1, markerHeight);
    } else {
        markerContext.fillStyle = 'rgb(0, 255, 0)';
        markerContext.fillRect(start, 0, 1, markerHeight);
        markerContext.fillStyle = 'rgb(255, 0, 0)';
        markerContext.fillRect(end, 0, 1, markerHeight);
    }
};

handleMarkerDrag = function (e) {
    var duration = e.offsetX / (markerWidth - 1);
    player.setDuration(duration);
    drawMarkers();
};

animation = function (timestamp) {
    if (loading)
        return;
    duration = player.duration();
    if (duration != lastDuration) {
        lastDuration = duration;
        var value = duration * 100;
        var width = value.toString() + '%';
        $('#progress').attr('aria-valuenow', value);
        $('#progress').css({'width': width});
    }
    requestAnimationFrame(animation);
};

$(function () {
    // Push default buttons.
    $('#source-stereo').addClass('active');
    $('#filter-flat').addClass('active');
    $('#pitch-x1').addClass('active');
    $('#speed-x1').addClass('active');
    
    // Initialize progress bar and markers
    $('.progress-bar').css({'transitionDuration': '0s'});
    markerWidth = $('#progress-view').width();
    markerHeight = $('#progress-view').height();
    markerContext = $('#progress-marker')[0].getContext('2d');
    markerContext.width =  markerWidth;
    markerContext.height = markerHeight;
    $('#progress-marker').width(markerWidth);
    $('#progress-marker').height(markerHeight);
    $('#progress-marker')[0].width = markerWidth;
    $('#progress-marker')[0].height = markerHeight;
    drawMarkers();

    // Set file handler.
    $('#file').on('change', function (e) {
        var file = e.target.files[0];
        var reader = new FileReader();
        reader.onload = function () {
$('#progress').parent().addClass('progress-striped');
$('#progress').parent().addClass('active');
$('#progress').css({'width': '100%'});
loading = true;
player.load(this.result, function () {
    loading = false;
    $('#progress').parent().removeClass('progress-striped');
    $('#progress').parent().removeClass('active');
    $('#progress').css({'width': '0%'});
    lastDuration = -1;
    drawMarkers();
    animation();
});
        };
        reader.readAsArrayBuffer(file);
    });

    // Set mouse navigation handler.    
    $('#progress-marker').on('mousedown', function (e) {
        markerDrag = true;
        handleMarkerDrag(e);
    });
    $('#progress-marker').on('mousemove', function (e) {
        if (!markerDrag)
return;
        handleMarkerDrag(e);
    });
    $('#progress-marker').on('mouseup', function (e) {
        markerDrag = false;
    });
    
    // TODO: Set darg & drop handler.
    
    // Set button click handler.
    $('.btn').on('click', function () {
        var handlers = {
'source-stereo': function () { player.setSource(Mp3Player.SOURCE_STEREO); },
'source-l+r': function () { player.setSource(Mp3Player.SOURCE_L_PLUS_R); },
'source-l': function () { player.setSource(Mp3Player.SOURCE_L); },
'source-r': function () { player.setSource(Mp3Player.SOURCE_R); },
'source-l-r': function () { player.setSource(Mp3Player.SOURCE_L_MINUS_R); },

'filter-flat': function () {},
'filter-1': function () { log('not implemented.'); },
'filter-2': function () { log('not implemented.'); },
'filter-3': function () { log('not implemented.'); },
'filter-4': function () { log('not implemented.'); },

'pitch-x2': function () { pitch = 2; player.setSpeed(speed, pitch); },
'pitch-x1': function () { pitch = 1; player.setSpeed(speed, pitch); },
'pitch-x0.5': function ()  { pitch = 0.5; player.setSpeed(speed, pitch); },

'speed-x2': function () { speed = 2; player.setSpeed(speed, pitch); },
'speed-x1': function () { speed = 1; player.setSpeed(speed, pitch); },
'speed-x0.5': function () { speed = 0.5; player.setSpeed(speed, pitch); },

'button-eject': fileOpenDialog,
'button-stepback': player.stepback.bind(player),
'button-stop': player.stop.bind(player),
'button-play': player.play.bind(player),
'button-pause': function () { player.pause(!player.isPaused()); },
'button-stepforward': player.stepforward.bind(player),
'button-mark-start': function () { player.markAsStart(); drawMarkers(); },
'button-mark-end': function () { player.markAsEnd(); drawMarkers(); }
        };
        var id = $(this).attr('id');
        if (!handlers[id])
return;
        handlers[id]();
    });
    $('.btn').on('mousedown', function () {
        var handlers = {
'button-back': function (q) { player.setSpeed(speed * -8, speed * 8); },
'button-forward': function (q) { player.setSpeed(speed * 8, speed * 8); },
        };
        var id = $(this).attr('id');
        if (!handlers[id])
return;
        handlers[id]();
    });
    $('.btn').on('mouseup', function () {
        var handlers = {
'button-back': function () { player.setSpeed(speed, pitch); },
'button-forward': function () { player.setSpeed(speed, pitch); },
        };
        var id = $(this).attr('id');
        if (!handlers[id])
return;
        handlers[id]();
    });
    $('body').on('keydown', function (e) {
        var handlers = {
'E': [ fileOpenDialog, null ],
'Z': [ function (q) { player.setSpeed(speed * -8, speed * 8); }, player.stepback.bind(player) ],
'S': [ player.stop.bind(player), null ],
' ': [ player.play.bind(player), null ],
'X': [ function (q) { player.pause(!player.isPaused()); }, null ],
'C': [ function (q) { player.setSpeed(speed * 8, speed * 8); }, player.stepforward.bind(player) ],
'N': [ function (q) { player.markAsStart(); drawMarkers(); }, null ],
'M': [ function (q) { player.markAsEnd(); drawMarkers(); }, null ]
        }
        var char = String.fromCharCode(e.keyCode);
        if (!handlers[char])
return;
        var index = e.shiftKey ? 1 : 0;
        if (!handlers[char][index])
return;
        handlers[char][index]();
    });
    $('body').on('keyup', function (e) {
        var handlers = {
'Z': function () { player.setSpeed(speed, pitch); },
'C': function () { player.setSpeed(speed, pitch); }
        }
        var char = String.fromCharCode(e.keyCode);
        if (!handlers[char])
return;
        handlers[char]();
    });
});

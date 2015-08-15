Mp3Player = function () {
    // TODO: Buffer size should depend on ratio since dominant frequency depends on
    this.bufferSize = 2048;

    this.audioBuffer = null;
    this.audioLeft = null;
    this.audioRight = null;
    this.audioOffset = 0;
    this.audioLength = 0;
    this.audioStartPoint = 0;
    this.audioEndPoint = 0;
    this.audioPause = true;
    this.audioSpeed = 1;
    this.audioPitch = 1;
    this.audioSource = Mp3Player.SOURCE_STEREO;
    this.id3 = null;
    this.image = null;
    
    this.buffer = [
        new Float32Array(this.bufferSize * 8),
        new Float32Array(this.bufferSize * 8)
    ];
    
    this.clipSize = this.bufferSize;
    this.clipTable = new Float32Array(this.clipSize);
    for (var i = 0; i < this.clipSize; ++i)
        this.clipTable[i] = Math.sin(Math.PI * i / (this.clipSize - 1));

    this.audioContext = new AudioContext();
    this.audioProcessor = this.audioContext.createScriptProcessor(this.bufferSize, 0, 2);
    this.audioProcessor.onaudioprocess = this._onAudioProcess.bind(this);
    this.audioProcessor.connect(this.audioContext.destination);
};

Mp3Player.SOURCE_STEREO = 0;
Mp3Player.SOURCE_L_PLUS_R = 1;
Mp3Player.SOURCE_L = 2;
Mp3Player.SOURCE_R = 3;
Mp3Player.SOURCE_L_MINUS_R = 4;

Mp3Player.prototype._onAudioProcess = function (e) {
    var rate = this.audioPitch / this.audioSpeed;
    if (rate == 1 || rate == -1)
        this._onAudioProcessSimple(e);
    else
        this._onAudioProcessStretch(e);
}

Mp3Player.prototype._getBuffer = function (offset, range) {
    var left = this.buffer[0];
    var right = this.buffer[1];
    var i;
    var index = offset;
    var size = Math.abs(range);
    if (range < 0) {
        for (i = 0; i < size; ++i) {
            if (index != this.audioStartPoint)
                index--;
            else
                index = this.audioEndPoint;
        }
        offset = index;
    }
    var nextOffset = offset + size;
    if (this.audioSource == Mp3Player.SOURCE_STEREO) {
        if ((index + size) <= this.audioEndPoint) {
            left = this.audioLeft.subarray(index, index + size);
            right = this.audioRight.subarray(index, index + size);
        } else {
            for (i = 0; i < size; ++i) {
                this.buffer[0][i] = this.audioLeft[index];
                this.buffer[1][i] = this.audioRight[index];
                if (index != this.audioEndPoint)
                    index++;
                else
                    index = this.audioStartPoint;
            }
            nextOffset = index;
        }
    } else if (this.audioSource == Mp3Player.SOURCE_L_PLUS_R) {
        right = this.buffer[0];
        for (i = 0; i < size; ++i) {
            this.buffer[0][i] = (this.audioLeft[index] + this.audioRight[index]) / 2;
            if (index != this.audioEndPoint)
                index++;
            else
                index = this.audioStartPoint;
        }
        nextOffset = index;
    } else if (this.audioSource == Mp3Player.SOURCE_L) {
        if ((index + size) <= this.audioEndPoint) {
            left = this.audioLeft.subarray(index, index + size);
            right = this.audioLeft.subarray(index, index + size);
        } else {
            right = this.buffer[0];
            for (i = 0; i < size; ++i) {
                this.buffer[0][i] = this.audioLeft[index];
                if (index != this.audioEndPoint)
                    index++;
                else
                    index = this.audioStartPoint;
            }
            nextOffset = index;
        }
    } else if (this.audioSource == Mp3Player.SOURCE_R) {
        if ((index + size) <= this.audioEndPoint) {
            left = this.audioRight.subarray(index, index + size);
            right = this.audioRight.subarray(index, index + size);
        } else {
            right = this.buffer[0];
            for (i = 0; i < size; ++i) {
                this.buffer[0][i] = this.audioRight[index];
                if (index != this.audioEndPoint)
                    index++;
                else
                    index = this.audioStartPoint;
            }
            nextOffset = index;
        }
    } else {
        right = this.buffer[0];
        for (i = 0; i < size; ++i) {
            this.buffer[0][i] = (this.audioLeft[index] - this.audioRight[index]) / 2;
            if (index != this.audioEndPoint)
                index++;
            else
                index = this.audioStartPoint;
        }
        nextOffset = index;
    }
    return {
        'left': left,
        'right': right,
        'offset': (range < 0) ? offset : nextOffset
    };
}

Mp3Player.prototype._onAudioProcessSimple = function (e) {
    var left = e.outputBuffer.getChannelData(0);
    var right = e.outputBuffer.getChannelData(1);
    var length = left.length;
    var i;
    if (this.audioBuffer === null || this.audioPause) {
        for (i = 0; i < length; ++i)
            left[i] = right[i] = 0;
        return;
    }
    var speed = this.audioSpeed;
    var buffer;
    var consumeLength = length * speed;
    var buffer = this._getBuffer(this.audioOffset, consumeLength);
    var inL = buffer.left;
    var inR = buffer.right;
    if (speed >= 0) {
        for (i = 0; i < length; ++i) {
            left[i] = inL[(i * speed)|0];
            right[i] = inR[(i * speed)|0];
        }
    } else {
        for (i = 0; i < length; ++i) {
            left[length - 1 - i] = inL[(i * -speed)|0];
            right[length - 1 - i] = inR[(i * -speed)|0];
        }
    }
    this.audioOffset = buffer.offset;
};

// TODO: Rewrite to use _getBuffer.
Mp3Player.prototype._onAudioProcessStretch = function (e) {
    var rate = this.audioSpeed / this.audioPitch;

    var left = e.outputBuffer.getChannelData(0);
    var right = e.outputBuffer.getChannelData(1);
    var totalLength = left.length;
    var length = totalLength;
    if (this.audioBuffer === null || this.audioPause) {
        length = 0;
    } else {
        // TODO: Handle buffer size correctly. (rate can be 0.25, 0.5, 1, 2, 4)
        if (this.audioOffset + length > this.audioLength)
            length = this.audioLength - this.audioOffset;
    }

    var inL = this.audioLeft;
    var inR = this.audioRight;
    var offset = this.audioOffset;
    var speed = this.audioPitch;
    var i;
    var halfSize = length / 2;
    var shiftSize = halfSize * rate;
    for (i = 0; i < halfSize; ++i) {
        left[i] = inL[(offset + i * speed + shiftSize)|0] * this.clipTable[i + halfSize];
        right[i] = inR[(offset + i * speed + shiftSize)|0] * this.clipTable[i + halfSize];
    }
    for (i = halfSize; i < length; ++i) {
        left[i] = inL[(offset + i * speed - shiftSize)|0] * this.clipTable[i - halfSize];
        right[i] = inR[(offset + i * speed - shiftSize)|0] * this.clipTable[i - halfSize];
    }
    for (i = 0; i < length; ++i) {
        left[i] += inL[(offset + i * speed)|0] * this.clipTable[i];
        right[i] += inR[(offset + i * speed)|0] * this.clipTable[i];
    }
    this.audioOffset += length * this.audioSpeed;
    
    for (i = length; i < totalLength; ++i)
        left[i] = right[i] = 0;
};

Mp3Player.prototype.load = function (file, cb) {
    this.id3 = new ID3v2(file);
    if (this.id3.error()) {
        console.error(this.id3.error());
        this.id3 = null;
    } else {
        console.log('title: ' + this.id3.title());
        console.log('album: ' + this.id3.album());
        console.log('artist: ' + this.id3.artist());
    }
    this.audioContext.decodeAudioData(file, function(buffer) {
        this.audioPause = true;
        this.audioBuffer = null;
        this.audioOffset = 0;
        this.audioLeft = buffer.getChannelData(0);
        if (buffer.numberOfChannels < 2)
            this.audioRight = this.audioLeft;
        else
            this.audioRight = buffer.getChannelData(1);
        this.audioBuffer = buffer;
        this.audioLength = Math.min(this.audioLeft.length, this.audioRight.length);
        this.audioStartPoint = 0;
        this.audioEndPoint = this.audioLength - 1;
        if (cb)
            cb();
    }.bind(this));
};

Mp3Player.prototype.play = function () {
    this.audioOffset = this.audioStartPoint;
    this.audioPause = false;
};

Mp3Player.prototype.pause = function (pause) {
    this.audioPause = pause;
};

Mp3Player.prototype.stop = function () {
    this.audioOffset = this.audioStartPoint;
    this.audioPause = true;
};

Mp3Player.prototype.stepback = function () {
    this.audioOffset = 0;
};

Mp3Player.prototype.stepforward = function () {
    this.audioOffset = this.audioLength - 1;
};

Mp3Player.prototype.isPaused = function () {
    return this.audioPause && this.audioOffset != 0;
};

// Supported pairs are (8, 8), (-8, 8), and (n, m) [n,m | 1/2, 1, 2]
Mp3Player.prototype.setSpeed = function (speed, pitch) {
    this.audioSpeed = speed;
    this.audioPitch = pitch;
};

Mp3Player.prototype.setSource = function (mode) {
    this.audioSource = mode;
};

Mp3Player.prototype.setDuration = function (duration) {
    this.audioOffset = ((this.audioLength - 1) * duration)|0;
    if (this.audioOffset < this.audioStartPoint)
        this.audioStartPoint = this.audioOffset;
    if (this.audioOffset > this.audioEndPoint)
        this.audioEndPoint = this.audioOffset;
};

Mp3Player.prototype.duration = function () {
    return this.audioOffset / (this.audioLength - 1);
};

Mp3Player.prototype.startDuration = function () {
    return this.audioStartPoint / (this.audioLength - 1);
};

Mp3Player.prototype.endDuration = function () {
    return this.audioEndPoint / (this.audioLength - 1);
};

Mp3Player.prototype.markAsStart = function () {
    this.audioStartPoint = this.audioOffset;
};

Mp3Player.prototype.markAsEnd = function () {
    this.audioEndPoint = this.audioOffset;
};

Mp3Player.prototype.imageUrl = function () {
    if (!this.id3 || !this.id3.image())
        return 'icon_128.png';
    var imageData = this.id3.image();
    var imageType = this.id3.imageType();
    this.image = new Blob([imageData], { type: imageType });
    return URL.createObjectURL(this.image);
};

Mp3Player.prototype.album = function () {
    if (!this.id3 || !this.id3.album())
        return '';
    return this.id3.album();
};

Mp3Player.prototype.artist = function () {
    if (!this.id3 || !this.id3.artist())
        return '';
    return this.id3.artist();
};

Mp3Player.prototype.title = function () {
    if (!this.id3 || !this.id3.title())
        return '';
    return this.id3.title();
};

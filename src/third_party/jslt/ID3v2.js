/**
 * Copyright (c) 2015, Takashi Toyoshima <toyoshim@gmail.com>
 * All rights reserved.
 * Use of this source code is governed by a BSD-style license that can be found
 * in the LICENSE file.
 */
/**
 * ID3v2 class.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 * @param buffer {ArrayBuffer} audio container file object.
 * @param offset {Number} offset to start in bytes (optional).
 * @param size {Number} size in bytes (optional).
 * @constructor
 */
function ID3v2 (buffer, offset, size) {
    if (buffer.constructor.name != 'ArrayBuffer')
       throw Error('the first argument should be an instance of ArrayBuffer');
    if (!offset)
        offset = 0;
    if (!size)
        size = buffer.byteLength - offset;
    this._version = '2.0';
    this._title = '';
    this._artist = '';
    this._album = '';
    this._image = null;
    this._imageType = 'image/x-unknown';
    this._error = this._parse(new DataView(buffer, offset, size));
}
try {
    exports.ID3v2 = ID3v2;
} catch (e) {}

/**
 * Prases a tar data.
 */
ID3v2.prototype._parse = function (data) {
    var magic = 'ID3';
    if (data.getUint8(0) != magic.charCodeAt(0) ||
        data.getUint8(1) != magic.charCodeAt(1) ||
        data.getUint8(2) != magic.charCodeAt(2)) {
        return 'ID3: invalid header magic.';
    }
    this._version = '2.' +
                    data.getUint8(3).toString(10) + '.' +
                    data.getUint8(4).toString(10);
    var flag = data.getUint8(5);
    var unsynchronisation = 0 != (flag & 0x80);
    var extendedHeader = 0 != (flag & 0x40);
    var experimentalIndicator = 0 != (flag & 0x20);
    var unknown = 0 != (flag & 0x1f);
    if (unsynchronisation)
        return 'ID3: unsynchronisation flag is not supported.';
    if (unknown)
        return 'ID3: unknown flag(s) is/are set.';
    var sizeData = data.getUint32(6, false);
    if (sizeData & 0x80808080)
        return 'ID3: MSB of size is broken.';
    var size = ((sizeData & 0xff000000) >> 3) |
               ((sizeData & 0x00ff0000) >> 2) |
               ((sizeData & 0x0000ff00) >> 1) |
               (sizeData & 0x000000ff);

    var offset = 10;

    var parseASCII = function (data, offset, size) {
        var ascii = [];
        var next = offset + size;
        for (var i = offset; i < next; ++i) {
            c = data.getUint8(i);
            if (!c)
                break;
            ascii.push(String.fromCharCode(c));
        }
        return ascii.join('');
    };

    var parseString = function (data, offset, size) {
        var mode = data.getUint8(offset);
        var i = offset + 1;
        var next = offset + size;
        var c;
        if (mode == 0) {
            return { result: true, value: parseASCII(data, i, next - i) };
        } else if (mode == 1 || mode == 2) {
            var littleEndian = false;
            if (mode == 1) {
                var first = data.getUint8(i++);
                var second = data.getUint8(i++);
                if (first == 0xff && second == 0xfe)
                    littleEndian = true;
                else if (first == 0xfe && second == 0xff)
                    littleEndian = false;
                else
                    return { result: false, value: 'ID3: invalid BOM' };
            }
            var ucs2 = [];
            while (i < next) {
                c = data.getUint16(i, littleEndian);
                i += 2;
                if (!c)
                    break;
                ucs2.push(String.fromCharCode(c));
            }
            return { result: true, value: ucs2.join('') };
        }
        return { result: false, value: 'ID3: unknown text code' };
    };

    for (var i = 0; i < size; i += 10) {
        var frameId = parseASCII(data, offset + i, 4);
        var frameSize = data.getUint32(offset + i + 4, false);
        var frameFlags = data.getUint16(offset + i + 8, false);
        var compression = 0 != (frameFlags & 0x0080);
        var encryption = 0 != (frameFlags & 0x0040);
        var groupingIdentity = 0 != (frameFlags & 0x0020);
        if (compression)
            return 'ID3: compressed frame is not supported.';
        if (encryption)
            return 'ID3: encrypted frame is not supported.';
        if (groupingIdentity)
            return 'ID3: frame group is not supported.';
        if (frameFlags & 0x1f1f)
            return 'ID3: unknown frame flag(s) is/are set.';
        if (frameId == 'TIT2') {
            var title = parseString(data, offset + i + 10, frameSize);
            if (!title.result)
                return title.value;
            this._title = title.value;
        } else if (frameId == 'TPE1') {
            var artist = parseString(data, offset + i + 10, frameSize);
            if (!artist.result)
                return artist.value;
            this._artist = artist.value;
        } else if (frameId == 'TALB') {
            var album = parseString(data, offset + i + 10, frameSize);
            if (!album.result)
                return album.value;
            this._album = album.value;
        } else if (frameId == 'APIC') {
            var commentCode = data.getUint8(offset + i + 10);
            var mime = parseASCII(data, offset + i + 11, frameSize - 1);
            var commentOffset = offset + i + 11 + mime.length + 1;
            var commentPos = commentOffset;
            var commentNext = commentOffset + 64;
            var comment;
            if (commentCode == 0 || commentCode == 3) {
                while (commentPos < commentNext) {
                    var comment = data.getUint8(commentPos);
                    commentPos++;
                    if (!comment)
                        break;
                }
            } else if (commentCode == 1 || commentCode == 2) {
                while (commentPos < commentNext) {
                    var comment = data.getUint16(commentPos);
                    commentPos += 2;
                    if (!comment)
                        break;
                }
            } else {
                return 'ID3: unknown picture comment code';
            }
            var imageOffset = commentPos;
            var imageSize = offset + i + 10 + frameSize - commentPos;
            this._image =
                    data.buffer.slice(imageOffset, imageOffset + imageSize);
            this._imageType = mime;
        } else if (frameId == 'TYER' ||  // Year
                   frameId == 'TRCK' ||  // Track number/Position in set
                   frameId == 'TPOS' ||  // Part of a set
                   frameId == 'TCON' ||  // Content type
                   frameId == 'PRIV') {  // Private frame
            // Ignore these known frames.
        } else {
            console.log('ID3: skip unknown frame id: ' + frameId);
        }
        i += frameSize;
    }

    return null;
};

/**
 * Get a version number.
 * @return version in string or null if failed to parse.
 */
ID3v2.prototype.version = function () {
    if (this._error)
        return null;
    return this._version;
};

/**
 * Get an error message.
 * @return error message in string of null if no errors.
 */
ID3v2.prototype.error = function () {
    return this._error;
};

/**
 * Get song title.
 * @return music title in string.
 */
ID3v2.prototype.title = function () {
    return this._title;
};

/**
 * Get album title.
 * @return music album title in string.
 */
ID3v2.prototype.album = function () {
    return this._album;
};

/**
 * Get artist name.
 * @return artist name in string.
 */
ID3v2.prototype.artist = function () {
    return this._artist;
};

/**
 * Get image data.
 * @return image data in ArrayBuffer.
 */
ID3v2.prototype.image = function () {
    return this._image;
};

/**
 * Get image data type.
 * @return image data MIME type in string.
 */
ID3v2.prototype.imageType = function () {
    return this._imageType;
};


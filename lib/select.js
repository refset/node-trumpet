var Stream = require('stream').Stream;

module.exports = function (parser) {
    var stream = new Stream;
    stream.writable = true;
    stream.readable = true;
    
    var selectors = [];
    
    stream.select = function (s, fn) {
        var sel = createSelector(s, fn);
        selectors.push(sel);
        return stream;
    };
    
    stream.update = function (name, t) {
        if (name === 'open') {
            selectors.forEach(function (sel) {
                sel(t, parser)
            });
        }
        else if (name === 'close') {
            selectors.forEach(function (sel) {
                sel.pending = sel.pending.filter(function (p) {
                    var done = p.level >= parser.tags.length;
                    if (done) p.callback(p.buffered);
                    return !done;
                });
            });
        }
    };
    
    stream.raw = function (s) {
        selectors.forEach(function (sel) {
            sel.pending.forEach(function (p) {
                p.buffered += s;
            });
        });
    };
    
    return stream;
};

function createSelector (selector, fn) {
    var parts = selector.split(/([\s>+]+)/).map(function (s) {
        if (s.match(/^\s+$/)) return;
        var op = s.trim();
        if (op === '>' || op === '+') return { combinator : op };
        
        var m = {
            name : s.match(/^([\w-]+|\*)/),
            class : s.match(/\.([\w-]+)/),
            id : s.match(/#([\w-]+)/),
            pseudo : s.match(/:([\w-]+)/),
            attribute : s.match(/\[([^\]]+)\]/),
        };
        
        return {
            name : m.name && m.name[1].toUpperCase(),
            class : m.class && m.class[1],
            id : m.id && m.id[1],
            pseudo : m.pseudo && m.pseudo[1],
            attribute : m.attribute && m.attribute[1],
        };
    }).filter(Boolean);
    
    var depth = parts.reduce(function (sum, s) {
        return sum + (s.combinator ? 0 : 1);
    }, 0);
    
    var sel = function (tag, parser) {
        var tags = parser.tags;
        if (depth > tags.length) return;
        
        // hypothesis: the selector matches
        var j = parts.length - 1;
        var i = tags.length - 1;
        
        for (; j >= 0; j--, i--) {
            var t = tags[i];
            var p = parts[j];
            
            // try to falsify the hypothesis on each tag/part match:
            if (p.name && p.name !== t.name) return;
            if (p.class && p.class !== t.attributes.class) return;
            if (p.id && p.id !== t.attributes.id) return;
        }
        
        var p = { level : tags.length };
        fn({
            name : tag.name.toLowerCase(),
            attributes : tag.attributes,
            text : function (cb) {
                p.buffered = '';
                p.callback = cb;
                sel.pending.push(p);
            },
        });
    };
    
    sel.pending = [];
    
    return sel;
}
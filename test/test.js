"use strict";
Error.stackTraceLimit = -1;

var go$reservedKeywords = ["abstract", "arguments", "boolean", "break", "byte", "case", "catch", "char", "class", "const", "continue", "debugger", "default", "delete", "do", "double", "else", "enum", "eval", "export", "extends", "false", "final", "finally", "float", "for", "function", "goto", "if", "implements", "import", "in", "instanceof", "int", "interface", "let", "long", "native", "new", "package", "private", "protected", "public", "return", "short", "static", "super", "switch", "synchronized", "this", "throw", "throws", "transient", "true", "try", "typeof", "var", "void", "volatile", "while", "with", "yield"];

var go$global;
if (typeof window !== "undefined") {
	go$global = window;
} else if (typeof GLOBAL !== "undefined") {
	go$global = GLOBAL;
}

var go$idCounter = 1;
var go$keys = function(m) { return m ? Object.keys(m) : []; };
var go$min = Math.min;
var go$parseInt = parseInt;
var go$parseFloat = parseFloat;
var go$reflect, go$newStringPtr;
var Go$Array = Array;
var Go$Error = Error;

var go$mapArray = function(array, f) {
	var newArray = new array.constructor(array.length), i;
	for (i = 0; i < array.length; i++) {
		newArray[i] = f(array[i]);
	}
	return newArray;
};

var go$newType = function(size, kind, string, name, pkgPath, constructor) {
	var typ;
	switch(kind) {
	case "Bool":
	case "Int":
	case "Int8":
	case "Int16":
	case "Int32":
	case "Uint":
	case "Uint8" :
	case "Uint16":
	case "Uint32":
	case "Uintptr":
	case "Float32":
	case "Float64":
	case "String":
	case "UnsafePointer":
		typ = function(v) { this.go$val = v; };
		typ.prototype.go$key = function() { return string + "$" + this.go$val; };
		break;

	case "Int64":
		typ = function(high, low) {
			this.high = (high + Math.floor(Math.ceil(low) / 4294967296)) >> 0;
			this.low = low >>> 0;
			this.go$val = this;
		};
		typ.prototype.go$key = function() { return string + "$" + this.high + "$" + this.low; };
		break;

	case "Uint64":
		typ = function(high, low) {
			this.high = (high + Math.floor(Math.ceil(low) / 4294967296)) >>> 0;
			this.low = low >>> 0;
			this.go$val = this;
		};
		typ.prototype.go$key = function() { return string + "$" + this.high + "$" + this.low; };
		break;

	case "Complex64":
	case "Complex128":
		typ = function(real, imag) {
			this.real = real;
			this.imag = imag;
			this.go$val = this;
		};
		typ.prototype.go$key = function() { return string + "$" + this.real + "$" + this.imag; };
		break;

	case "Array":
		typ = function(v) { this.go$val = v; };
		typ.Ptr = go$newType(4, "Ptr", "*" + string, "", "", function(array) {
			this.go$get = function() { return array; };
			this.go$val = array;
		});
		typ.init = function(elem, len) {
			typ.elem = elem;
			typ.len = len;
			typ.prototype.go$key = function() {
				return string + "$" + go$mapArray(this.go$val, function(e) {
					var key = e.go$key ? e.go$key() : String(e);
					return key.replace(/\\/g, "\\\\").replace(/\$/g, "\\$");
				}).join("$");
			};
			typ.extendReflectType = function(rt) {
				rt.arrayType = new go$reflect.arrayType(rt, elem.reflectType(), undefined, len);
			};
			typ.Ptr.init(typ);
		};
		break;

	case "Chan":
		typ = function() { this.go$val = this; };
		typ.prototype.go$key = function() {
			if (this.go$id === undefined) {
				this.go$id = go$idCounter;
				go$idCounter++;
			}
			return String(this.go$id);
		};
		typ.init = function(elem, sendOnly, recvOnly) {
			typ.nil = new typ();
			typ.extendReflectType = function(rt) {
				rt.chanType = new go$reflect.chanType(rt, elem.reflectType(), sendOnly ? go$reflect.SendDir : (recvOnly ? go$reflect.RecvDir : go$reflect.BothDir));
			};
		};
		break;

	case "Func":
		typ = function(v) { this.go$val = v; };
		typ.init = function(params, results, variadic) {
			typ.params = params;
			typ.results = results;
			typ.variadic = variadic;
			typ.extendReflectType = function(rt) {
				var typeSlice = (go$sliceType(go$ptrType(go$reflect.rtype)));
				rt.funcType = new go$reflect.funcType(rt, variadic, new typeSlice(go$mapArray(params, function(p) { return p.reflectType(); })), new typeSlice(go$mapArray(results, function(p) { return p.reflectType(); })));
			};
		};
		break;

	case "Interface":
		typ = { implementedBy: [] };
		typ.init = function(methods) {
			typ.extendReflectType = function(rt) {
				var imethods = go$mapArray(methods, function(m) {
					return new go$reflect.imethod(go$newStringPtr(m[0]), go$newStringPtr(m[1]), m[2].reflectType());
				});
				var methodSlice = (go$sliceType(go$ptrType(go$reflect.imethod)));
				rt.interfaceType = new go$reflect.interfaceType(rt, new methodSlice(imethods));
			};
		};
		break;

	case "Map":
		typ = function(v) { this.go$val = v; };
		typ.init = function(key, elem) {
			typ.key = key;
			typ.elem = elem;
			typ.extendReflectType = function(rt) {
				rt.mapType = new go$reflect.mapType(rt, key.reflectType(), elem.reflectType(), undefined, undefined);
			};
		};
		break;

	case "Ptr":
		typ = constructor || function(getter, setter) {
			this.go$get = getter;
			this.go$set = setter;
			this.go$val = this;
		};
		typ.prototype.go$key = function() {
			if (this.go$id === undefined) {
				this.go$id = go$idCounter;
				go$idCounter++;
			}
			return String(this.go$id);
		};
		typ.init = function(elem) {
			typ.nil = new typ(go$throwNilPointerError, go$throwNilPointerError);
			typ.extendReflectType = function(rt) {
				rt.ptrType = new go$reflect.ptrType(rt, elem.reflectType());
			};
		};
		break;

	case "Slice":
		var nativeArray;
		typ = function(array) {
			if (array.constructor !== nativeArray) {
				array = new nativeArray(array);
			}
			this.array = array;
			this.offset = 0;
			this.length = array.length;
			this.capacity = array.length;
			this.go$val = this;
		};
		typ.make = function(length, capacity, zero) {
			capacity = capacity || length;
			var array = new nativeArray(capacity), i;
			for (i = 0; i < capacity; i++) {
				array[i] = zero();
			}
			var slice = new typ(array);
			slice.length = length;
			return slice;
		};
		typ.init = function(elem) {
			typ.elem = elem;
			nativeArray = go$nativeArray(elem.kind);
			typ.nil = new typ([]);
			typ.extendReflectType = function(rt) {
				rt.sliceType = new go$reflect.sliceType(rt, elem.reflectType());
			};
		};
		break;

	case "Struct":
		typ = function(v) { this.go$val = v; };
		typ.Ptr = go$newType(4, "Ptr", "*" + string, "", "", constructor);
		typ.Ptr.Struct = typ;
		typ.init = function(fields) {
			typ.Ptr.init(typ);
			typ.Ptr.nil = new constructor();
			var i;
			for (i = 0; i < fields.length; i++) {
				var field = fields[i];
				Object.defineProperty(typ.Ptr.nil, field[0], { get: go$throwNilPointerError, set: go$throwNilPointerError });
			}
			typ.prototype.go$key = function() {
				var keys = new Array(fields.length);
				for (i = 0; i < fields.length; i++) {
					var v = this.go$val[go$fieldName(fields, i)];
					var key = v.go$key ? v.go$key() : String(v);
					keys[i] = key.replace(/\\/g, "\\\\").replace(/\$/g, "\\$");
				}
				return string + "$" + keys.join("$");
			};
			typ.extendReflectType = function(rt) {
				var reflectFields = new Array(fields.length), i;
				for (i = 0; i < fields.length; i++) {
					var field = fields[i];
					reflectFields[i] = new go$reflect.structField(go$newStringPtr(field[0]), go$newStringPtr(field[1]), field[2].reflectType(), go$newStringPtr(field[3]), i);
				}
				rt.structType = new go$reflect.structType(rt, new (go$sliceType(go$reflect.structField))(reflectFields));
			};
		};
		break;

	default:
		throw go$panic("invalid kind: " + kind);
	}

	typ.kind = kind;
	typ.string = string;
	typ.typeName = name;
	typ.pkgPath = pkgPath;
	var rt = null;
	typ.reflectType = function() {
		if (rt === null) {
			rt = new go$reflect.rtype(size, 0, 0, 0, 0, go$reflect.kinds[kind], undefined, undefined, go$newStringPtr(string), undefined, undefined);
			rt.jsType = typ;

			var methods = [];
			if (typ.methods !== undefined) {
				var i;
				for (i = 0; i < typ.methods.length; i++) {
					var m = typ.methods[i];
					methods.push(new go$reflect.method(go$newStringPtr(m[0]), go$newStringPtr(m[1]), go$funcType(m[2], m[3], m[4]).reflectType(), go$funcType([typ].concat(m[2]), m[3], m[4]).reflectType(), undefined, undefined));
				}
			}
			if (name !== "" || methods.length !== 0) {
				var methodSlice = (go$sliceType(go$ptrType(go$reflect.method)));
				rt.uncommonType = new go$reflect.uncommonType(go$newStringPtr(name), go$newStringPtr(pkgPath), new methodSlice(methods));
			}

			if (typ.extendReflectType !== undefined) {
				typ.extendReflectType(rt);
			}
		}
		return rt;
	};
	return typ;
};

var Go$Bool          = go$newType( 1, "Bool",          "bool",           "bool",       "", null);
var Go$Int           = go$newType( 4, "Int",           "int",            "int",        "", null);
var Go$Int8          = go$newType( 1, "Int8",          "int8",           "int8",       "", null);
var Go$Int16         = go$newType( 2, "Int16",         "int16",          "int16",      "", null);
var Go$Int32         = go$newType( 4, "Int32",         "int32",          "int32",      "", null);
var Go$Int64         = go$newType( 8, "Int64",         "int64",          "int64",      "", null);
var Go$Uint          = go$newType( 4, "Uint",          "uint",           "uint",       "", null);
var Go$Uint8         = go$newType( 1, "Uint8",         "uint8",          "uint8",      "", null);
var Go$Uint16        = go$newType( 2, "Uint16",        "uint16",         "uint16",     "", null);
var Go$Uint32        = go$newType( 4, "Uint32",        "uint32",         "uint32",     "", null);
var Go$Uint64        = go$newType( 8, "Uint64",        "uint64",         "uint64",     "", null);
var Go$Uintptr       = go$newType( 4, "Uintptr",       "uintptr",        "uintptr",    "", null);
var Go$Float32       = go$newType( 4, "Float32",       "float32",        "float32",    "", null);
var Go$Float64       = go$newType( 8, "Float64",       "float64",        "float64",    "", null);
var Go$Complex64     = go$newType( 8, "Complex64",     "complex64",      "complex64",  "", null);
var Go$Complex128    = go$newType(16, "Complex128",    "complex128",     "complex128", "", null);
var Go$String        = go$newType( 0, "String",        "string",         "string",     "", null);
var Go$UnsafePointer = go$newType( 4, "UnsafePointer", "unsafe.Pointer", "Pointer",    "", null);

var go$nativeArray = function(elemKind) {
	return ({ Int: Int32Array, Int8: Int8Array, Int16: Int16Array, Int32: Int32Array, Uint: Uint32Array, Uint8: Uint8Array, Uint16: Uint16Array, Uint32: Uint32Array, Uintptr: Uint32Array, Float32: Float32Array, Float64: Float64Array })[elemKind] || Array;
};
var go$toNativeArray = function(elemKind, array) {
	var nativeArray = go$nativeArray(elemKind);
	if (nativeArray === Array) {
		return array;
	}
	return new nativeArray(array);
};
var go$makeNativeArray = function(elemKind, length, zero) {
	var array = new (go$nativeArray(elemKind))(length), i;
	for (i = 0; i < length; i++) {
		array[i] = zero();
	}
	return array;
};
var go$arrayTypes = {};
var go$arrayType = function(elem, len) {
	var string = "[" + len + "]" + elem.string;
	var typ = go$arrayTypes[string];
	if (typ === undefined) {
		typ = go$newType(0, "Array", string, "", "", null);
		typ.init(elem, len);
		go$arrayTypes[string] = typ;
	}
	return typ;
};

var go$chanType = function(elem, sendOnly, recvOnly) {
	var string = (recvOnly ? "<-" : "") + "chan" + (sendOnly ? "<- " : " ") + elem.string;
	var field = sendOnly ? "SendChan" : (recvOnly ? "RecvChan" : "Chan");
	var typ = elem[field];
	if (typ === undefined) {
		typ = go$newType(0, "Chan", string, "", "", null);
		typ.init(elem, sendOnly, recvOnly);
		elem[field] = typ;
	}
	return typ;
};

var go$funcTypes = {};
var go$funcType = function(params, results, variadic) {
	var paramTypes = go$mapArray(params, function(p) { return p.string; });
	if (variadic) {
		paramTypes[paramTypes.length - 1] = "..." + paramTypes[paramTypes.length - 1].substr(2);
	}
	var string = "func(" + paramTypes.join(", ") + ")";
	if (results.length === 1) {
		string += " " + results[0].string;
	} else if (results.length > 1) {
		string += " (" + go$mapArray(results, function(r) { return r.string; }).join(", ") + ")";
	}
	var typ = go$funcTypes[string];
	if (typ === undefined) {
		typ = go$newType(0, "Func", string, "", "", null);
		typ.init(params, results, variadic);
		go$funcTypes[string] = typ;
	}
	return typ;
};

var go$interfaceTypes = {};
var go$interfaceType = function(methods) {
	var string = "interface {}";
	if (methods.length !== 0) {
		string = "interface { " + go$mapArray(methods, function(m) {
			return (m[1] !== "" ? m[1] + "." : "") + m[0] + m[2].string.substr(4);
		}).join("; ") + " }";
	}
	var typ = go$interfaceTypes[string];
	if (typ === undefined) {
		typ = go$newType(0, "Interface", string, "", "", null);
		typ.init(methods);
		go$interfaceTypes[string] = typ;
	}
	return typ;
};
var go$emptyInterface = go$interfaceType([]);
var go$interfaceNil = { go$key: function() { return "nil"; } };
var go$error = go$newType(8, "Interface", "error", "error", "", null);
go$error.init([["Error", "", go$funcType([], [Go$String], false)]]);

var Go$Map = function() {};
(function() {
	var names = Object.getOwnPropertyNames(Object.prototype), i;
	for (i = 0; i < names.length; i++) {
		Go$Map.prototype[names[i]] = undefined;
	}
})();
var go$mapTypes = {};
var go$mapType = function(key, elem) {
	var string = "map[" + key.string + "]" + elem.string;
	var typ = go$mapTypes[string];
	if (typ === undefined) {
		typ = go$newType(0, "Map", string, "", "", null);
		typ.init(key, elem);
		go$mapTypes[string] = typ;
	}
	return typ;
};

var go$throwNilPointerError = function() { go$throwRuntimeError("invalid memory address or nil pointer dereference"); };
var go$ptrType = function(elem) {
	var typ = elem.Ptr;
	if (typ === undefined) {
		typ = go$newType(0, "Ptr", "*" + elem.string, "", "", null);
		typ.init(elem);
		elem.Ptr = typ;
	}
	return typ;
};

var go$sliceType = function(elem) {
	var typ = elem.Slice;
	if (typ === undefined) {
		typ = go$newType(0, "Slice", "[]" + elem.string, "", "", null);
		typ.init(elem);
		elem.Slice = typ;
	}
	return typ;
};

var go$fieldName = function(fields, i) {
	var field = fields[i];
	var name = field[0];
	if (name === "") {
		var ntyp = field[2];
		if (ntyp.kind === "Ptr") {
			ntyp = ntyp.elem;
		}
		return ntyp.typeName;
	}
	if (name === "_" || go$reservedKeywords.indexOf(name) != -1) {
		return name + "$" + i;
	}
	return name;
};

var go$structTypes = {};
var go$structType = function(fields) {
	var string = "struct { " + go$mapArray(fields, function(f) {
		return f[0] + " " + f[2].string + (f[3] !== "" ? (' "' + f[3].replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"') : "");
	}).join("; ") + " }";
	var typ = go$structTypes[string];
	if (typ === undefined) {
		typ = go$newType(0, "Struct", string, "", "", function() {
			this.go$val = this;
			var i;
			for (i = 0; i < fields.length; i++) {
				this[go$fieldName(fields, i)] = arguments[i];
			}
		});
		typ.init(fields);
		var i, j;
		for (i = 0; i < fields.length; i++) {
			var field = fields[i];
			if (field[0] === "" && field[2].prototype !== undefined) {
				var methods = Object.keys(field[2].prototype);
				for (j = 0; j < methods.length; j++) {
					(function(fieldName, methodName, method) {
						typ.prototype[methodName] = function() {
							return method.apply(this.go$val[fieldName], arguments);
						};
						typ.Ptr.prototype[methodName] = function() {
							return method.apply(this[fieldName], arguments);
						};
					})(field[0], methods[j], field[2].prototype[methods[j]]);
				}
			}
		}
		go$structTypes[string] = typ;
	}
	return typ;
};

var go$stringPtrMap = new Go$Map();
go$newStringPtr = function(str) {
	if (str === undefined || str === "") {
		return go$ptrType(Go$String).nil;
	}
	var ptr = go$stringPtrMap[str];
	if (ptr === undefined) {
		ptr = new (go$ptrType(Go$String))(function() { return str; }, function(v) { str = v; });
		go$stringPtrMap[str] = ptr;
	}
	return ptr;
};
var go$newDataPointer = function(data, constructor) {
	return new constructor(function() { return data; }, function(v) { data = v; });
};

var go$float32bits = function(f) {
	var s, e;
	if (f === 0) {
		if (f === 0 && 1 / f === 1 / -0) {
			return 2147483648;
		}
		return 0;
	}
	if (!(f === f)) {
		return 2143289344;
	}
	s = 0;
	if (f < 0) {
		s = 2147483648;
		f = -f;
	}
	e = 150;
	while (f >= 1.6777216e+07) {
		f = f / (2);
		if (e === 255) {
			break;
		}
		e = (e + (1) >>> 0);
	}
	while (f < 8.388608e+06) {
		e = (e - (1) >>> 0);
		if (e === 0) {
			break;
		}
		f = f * (2);
	}
	return ((((s | (((e >>> 0) << 23) >>> 0)) >>> 0) | ((((((f + 0.5) >> 0) >>> 0) &~ 8388608) >>> 0))) >>> 0);
};

var go$flatten64 = function(x) {
	return x.high * 4294967296 + x.low;
};
var go$shiftLeft64 = function(x, y) {
	if (y === 0) {
		return x;
	}
	if (y < 32) {
		return new x.constructor(x.high << y | x.low >>> (32 - y), (x.low << y) >>> 0);
	}
	if (y < 64) {
		return new x.constructor(x.low << (y - 32), 0);
	}
	return new x.constructor(0, 0);
};
var go$shiftRightInt64 = function(x, y) {
	if (y === 0) {
		return x;
	}
	if (y < 32) {
		return new x.constructor(x.high >> y, (x.low >>> y | x.high << (32 - y)) >>> 0);
	}
	if (y < 64) {
		return new x.constructor(x.high >> 31, (x.high >> (y - 32)) >>> 0);
	}
	if (x.high < 0) {
		return new x.constructor(-1, 4294967295);
	}
	return new x.constructor(0, 0);
};
var go$shiftRightUint64 = function(x, y) {
	if (y === 0) {
		return x;
	}
	if (y < 32) {
		return new x.constructor(x.high >>> y, (x.low >>> y | x.high << (32 - y)) >>> 0);
	}
	if (y < 64) {
		return new x.constructor(0, x.high >>> (y - 32));
	}
	return new x.constructor(0, 0);
};
var go$mul64 = function(x, y) {
	var high = 0, low = 0, i;
	if ((y.low & 1) !== 0) {
		high = x.high;
		low = x.low;
	}
	for (i = 1; i < 32; i++) {
		if ((y.low & 1<<i) !== 0) {
			high += x.high << i | x.low >>> (32 - i);
			low += (x.low << i) >>> 0;
		}
	}
	for (i = 0; i < 32; i++) {
		if ((y.high & 1<<i) !== 0) {
			high += x.low << i;
		}
	}
	return new x.constructor(high, low);
};
var go$div64 = function(x, y, returnRemainder) {
	if (y.high === 0 && y.low === 0) {
		go$throwRuntimeError("integer divide by zero");
	}

	var s = 1;
	var rs = 1;

	var xHigh = x.high;
	var xLow = x.low;
	if (xHigh < 0) {
		s = -1;
		rs = -1;
		xHigh = -xHigh;
		if (xLow !== 0) {
			xHigh--;
			xLow = 4294967296 - xLow;
		}
	}

	var yHigh = y.high;
	var yLow = y.low;
	if (y.high < 0) {
		s *= -1;
		yHigh = -yHigh;
		if (yLow !== 0) {
			yHigh--;
			yLow = 4294967296 - yLow;
		}
	}

	var high = 0, low = 0, n = 0, i;
	while (yHigh < 2147483648 && ((xHigh > yHigh) || (xHigh === yHigh && xLow > yLow))) {
		yHigh = (yHigh << 1 | yLow >>> 31) >>> 0;
		yLow = (yLow << 1) >>> 0;
		n++;
	}
	for (i = 0; i <= n; i++) {
		high = high << 1 | low >>> 31;
		low = (low << 1) >>> 0;
		if ((xHigh > yHigh) || (xHigh === yHigh && xLow >= yLow)) {
			xHigh = xHigh - yHigh;
			xLow = xLow - yLow;
			if (xLow < 0) {
				xHigh--;
				xLow += 4294967296;
			}
			low++;
			if (low === 4294967296) {
				high++;
				low = 0;
			}
		}
		yLow = (yLow >>> 1 | yHigh << (32 - 1)) >>> 0;
		yHigh = yHigh >>> 1;
	}

	if (returnRemainder) {
		return new x.constructor(xHigh * rs, xLow * rs);
	}
	return new x.constructor(high * s, low * s);
};

var go$divComplex = function(n, d) {
	var ninf = n.real === 1/0 || n.real === -1/0 || n.imag === 1/0 || n.imag === -1/0;
	var dinf = d.real === 1/0 || d.real === -1/0 || d.imag === 1/0 || d.imag === -1/0;
	var nnan = !ninf && (n.real !== n.real || n.imag !== n.imag);
	var dnan = !dinf && (d.real !== d.real || d.imag !== d.imag);
	if(nnan || dnan) {
		return new n.constructor(0/0, 0/0);
	}
	if (ninf && !dinf) {
		return new n.constructor(1/0, 1/0);
	}
	if (!ninf && dinf) {
		return new n.constructor(0, 0);
	}
	if (d.real === 0 && d.imag === 0) {
		if (n.real === 0 && n.imag === 0) {
			return new n.constructor(0/0, 0/0);
		}
		return new n.constructor(1/0, 1/0);
	}
	var a = Math.abs(d.real);
	var b = Math.abs(d.imag);
	if (a <= b) {
		var ratio = d.real / d.imag;
		var denom = d.real * ratio + d.imag;
		return new n.constructor((n.real * ratio + n.imag) / denom, (n.imag * ratio - n.real) / denom);
	}
	var ratio = d.imag / d.real;
	var denom = d.imag * ratio + d.real;
	return new n.constructor((n.imag * ratio + n.real) / denom, (n.imag - n.real * ratio) / denom);
};

var go$subslice = function(slice, low, high, max) {
	if (low < 0 || high < low || max < high || high > slice.capacity || max > slice.capacity) {
		go$throwRuntimeError("slice bounds out of range");
	}
	var s = new slice.constructor(slice.array);
	s.offset = slice.offset + low;
	s.length = slice.length - low;
	s.capacity = slice.capacity - low;
	if (high !== undefined) {
		s.length = high - low;
	}
	if (max !== undefined) {
		s.capacity = max - low;
	}
	return s;
};

var go$sliceToArray = function(slice) {
	if (slice.length === 0) {
		return [];
	}
	if (slice.array.constructor !== Array) {
		return slice.array.subarray(slice.offset, slice.offset + slice.length);
	}
	return slice.array.slice(slice.offset, slice.offset + slice.length);
};

var go$decodeRune = function(str, pos) {
	var c0 = str.charCodeAt(pos);

	if (c0 < 0x80) {
		return [c0, 1];
	}

	if (c0 !== c0 || c0 < 0xC0) {
		return [0xFFFD, 1];
	}

	var c1 = str.charCodeAt(pos + 1);
	if (c1 !== c1 || c1 < 0x80 || 0xC0 <= c1) {
		return [0xFFFD, 1];
	}

	if (c0 < 0xE0) {
		var r = (c0 & 0x1F) << 6 | (c1 & 0x3F);
		if (r <= 0x7F) {
			return [0xFFFD, 1];
		}
		return [r, 2];
	}

	var c2 = str.charCodeAt(pos + 2);
	if (c2 !== c2 || c2 < 0x80 || 0xC0 <= c2) {
		return [0xFFFD, 1];
	}

	if (c0 < 0xF0) {
		var r = (c0 & 0x0F) << 12 | (c1 & 0x3F) << 6 | (c2 & 0x3F);
		if (r <= 0x7FF) {
			return [0xFFFD, 1];
		}
		if (0xD800 <= r && r <= 0xDFFF) {
			return [0xFFFD, 1];
		}
		return [r, 3];
	}

	var c3 = str.charCodeAt(pos + 3);
	if (c3 !== c3 || c3 < 0x80 || 0xC0 <= c3) {
		return [0xFFFD, 1];
	}

	if (c0 < 0xF8) {
		var r = (c0 & 0x07) << 18 | (c1 & 0x3F) << 12 | (c2 & 0x3F) << 6 | (c3 & 0x3F);
		if (r <= 0xFFFF || 0x10FFFF < r) {
			return [0xFFFD, 1];
		}
		return [r, 4];
	}

	return [0xFFFD, 1];
};

var go$encodeRune = function(r) {
	if (r < 0 || r > 0x10FFFF || (0xD800 <= r && r <= 0xDFFF)) {
		r = 0xFFFD;
	}
	if (r <= 0x7F) {
		return String.fromCharCode(r);
	}
	if (r <= 0x7FF) {
		return String.fromCharCode(0xC0 | r >> 6, 0x80 | (r & 0x3F));
	}
	if (r <= 0xFFFF) {
		return String.fromCharCode(0xE0 | r >> 12, 0x80 | (r >> 6 & 0x3F), 0x80 | (r & 0x3F));
	}
	return String.fromCharCode(0xF0 | r >> 18, 0x80 | (r >> 12 & 0x3F), 0x80 | (r >> 6 & 0x3F), 0x80 | (r & 0x3F));
};

var go$stringToBytes = function(str, terminateWithNull) {
	var array = new Uint8Array(terminateWithNull ? str.length + 1 : str.length), i;
	for (i = 0; i < str.length; i++) {
		array[i] = str.charCodeAt(i);
	}
	if (terminateWithNull) {
		array[str.length] = 0;
	}
	return array;
};

var go$bytesToString = function(slice) {
	if (slice.length === 0) {
		return "";
	}
	var str = "", i;
	for (i = 0; i < slice.length; i += 10000) {
		str += String.fromCharCode.apply(null, slice.array.subarray(slice.offset + i, slice.offset + Math.min(slice.length, i + 10000)));
	}
	return str;
};

var go$stringToRunes = function(str) {
	var array = new Int32Array(str.length);
	var rune, i, j = 0;
	for (i = 0; i < str.length; i += rune[1], j++) {
		rune = go$decodeRune(str, i);
		array[j] = rune[0];
	}
	return array.subarray(0, j);
};

var go$runesToString = function(slice) {
	if (slice.length === 0) {
		return "";
	}
	var str = "", i;
	for (i = 0; i < slice.length; i++) {
		str += go$encodeRune(slice.array[slice.offset + i]);
	}
	return str;
};

var go$needsExternalization = function(t) {
	switch (t.kind) {
		case "Int64":
		case "Uint64":
		case "Array":
		case "Func":
		case "Interface":
		case "Map":
		case "Slice":
		case "String":
			return true;
		default:
			return false;
	}
};

var go$externalize = function(v, t) {
	switch (t.kind) {
	case "Int64":
	case "Uint64":
		return go$flatten64(v);
	case "Array":
		if (go$needsExternalization(t.elem)) {
			return go$mapArray(v, function(e) { return go$externalize(e, t.elem); });
		}
		return v;
	case "Func":
		if (v === go$throwNilPointerError) {
			return null;
		}
		var convert = false;
		var i;
		for (i = 0; i < t.params.length; i++) {
			convert = convert || (t.params[i] !== go$packages["github.com/gopherjs/gopherjs/js"].Object);
		}
		for (i = 0; i < t.results.length; i++) {
			convert = convert || go$needsExternalization(t.results[i]);
		}
		if (!convert) {
			return v;
		}
		return function() {
			var args = [], i;
			for (i = 0; i < t.params.length; i++) {
				if (t.variadic && i === t.params.length - 1) {
					var vt = t.params[i].elem, varargs = [], j;
					for (j = i; j < arguments.length; j++) {
						varargs.push(go$internalize(arguments[j], vt));
					}
					args.push(new (t.params[i])(varargs));
					break;
				}
				args.push(go$internalize(arguments[i], t.params[i]));
			}
			var result = v.apply(undefined, args);
			switch (t.results.length) {
			case 0:
				return;
			case 1:
				return go$externalize(result, t.results[0]);
			default:
				for (i = 0; i < t.results.length; i++) {
					result[i] = go$externalize(result[i], t.results[i]);
				}
				return result;
			}
		};
	case "Interface":
		if (v === null) {
			return null;
		}
		if (v.constructor.kind === undefined) {
			return v; // js.Object
		}
		return go$externalize(v.go$val, v.constructor);
	case "Map":
		var m = {};
		var keys = go$keys(v), i;
		for (i = 0; i < keys.length; i++) {
			var entry = v[keys[i]];
			m[go$externalize(entry.k, t.key)] = go$externalize(entry.v, t.elem);
		}
		return m;
	case "Slice":
		if (go$needsExternalization(t.elem)) {
			return go$mapArray(go$sliceToArray(v), function(e) { return go$externalize(e, t.elem); });
		}
		return go$sliceToArray(v);
	case "String":
		var s = "", r, i, j = 0;
		for (i = 0; i < v.length; i += r[1], j++) {
			r = go$decodeRune(v, i);
			s += String.fromCharCode(r[0]);
		}
		return s;
	case "Struct":
		var timePkg = go$packages["time"];
		if (timePkg && v.constructor === timePkg.Time.Ptr) {
			var milli = go$div64(v.UnixNano(), new Go$Int64(0, 1000000));
			return new Date(go$flatten64(milli));
		}
		return v;
	default:
		return v;
	}
};

var go$internalize = function(v, t, recv) {
	switch (t.kind) {
	case "Bool":
		return !!v;
	case "Int":
		return parseInt(v);
	case "Int8":
		return parseInt(v) << 24 >> 24;
	case "Int16":
		return parseInt(v) << 16 >> 16;
	case "Int32":
		return parseInt(v) >> 0;
	case "Uint":
		return parseInt(v);
	case "Uint8" :
		return parseInt(v) << 24 >>> 24;
	case "Uint16":
		return parseInt(v) << 16 >>> 16;
	case "Uint32":
	case "Uintptr":
		return parseInt(v) >>> 0;
	case "Int64":
	case "Uint64":
		return new t(0, v);
	case "Float32":
	case "Float64":
		return parseFloat(v);
	case "Array":
		if (v.length !== t.len) {
			throw go$panic("got array with wrong size from JavaScript native");
		}
		return go$mapArray(v, function(e) { return go$internalize(e, t.elem); });
	case "Func":
		return function() {
			var args = [], i;
			for (i = 0; i < t.params.length; i++) {
				if (t.variadic && i === t.params.length - 1) {
					var vt = t.params[i].elem, varargs = arguments[i], j;
					for (j = 0; j < varargs.length; j++) {
						args.push(go$externalize(varargs.array[varargs.offset + j], vt));
					}
					break;
				}
				args.push(go$externalize(arguments[i], t.params[i]));
			}
			var result = v.apply(recv, args);
			switch (t.results.length) {
			case 0:
				return;
			case 1:
				return go$internalize(result, t.results[0]);
			default:
				for (i = 0; i < t.results.length; i++) {
					result[i] = go$internalize(result[i], t.results[i]);
				}
				return result;
			}
		};
	case "Interface":
		if (t === go$packages["github.com/gopherjs/gopherjs/js"].Object) {
			return v;
		}
		switch (v.constructor) {
		case Int8Array:
			return new (go$sliceType(Go$Int8))(v);
		case Int16Array:
			return new (go$sliceType(Go$Int16))(v);
		case Int32Array:
			return new (go$sliceType(Go$Int))(v);
		case Uint8Array:
			return new (go$sliceType(Go$Uint8))(v);
		case Uint16Array:
			return new (go$sliceType(Go$Uint16))(v);
		case Uint32Array:
			return new (go$sliceType(Go$Uint))(v);
		case Float32Array:
			return new (go$sliceType(Go$Float32))(v);
		case Float64Array:
			return new (go$sliceType(Go$Float64))(v);
		case Array:
			return go$internalize(v, go$sliceType(go$emptyInterface));
		case Boolean:
			return new Go$Bool(!!v);
		case Date:
			var timePkg = go$packages["time"];
			if (timePkg) {
				return new timePkg.Time(timePkg.Unix(new Go$Int64(0, 0), new Go$Int64(0, v.getTime() * 1000000)));
			}
		case Function:
			var funcType = go$funcType([go$sliceType(go$emptyInterface)], [go$packages["github.com/gopherjs/gopherjs/js"].Object], true);
			return new funcType(go$internalize(v, funcType));
		case Number:
			return new Go$Float64(parseFloat(v));
		case Object:
			var mapType = go$mapType(Go$String, go$emptyInterface);
			return new mapType(go$internalize(v, mapType));
		case String:
			return new Go$String(go$internalize(v, Go$String));
		}
		return v;
	case "Map":
		var m = new Go$Map();
		var keys = go$keys(v), i;
		for (i = 0; i < keys.length; i++) {
			var key = go$internalize(keys[i], t.key);
			m[key.go$key ? key.go$key() : key] = { k: key, v: go$internalize(v[keys[i]], t.elem) };
		}
		return m;
	case "Slice":
		return new t(go$mapArray(v, function(e) { return go$internalize(e, t.elem); }));
	case "String":
		v = String(v);
		var s = "", i;
		for (i = 0; i < v.length; i++) {
			s += go$encodeRune(v.charCodeAt(i));
		}
		return s;
	default:
		return v;
	}
};

var go$copySlice = function(dst, src) {
	var n = Math.min(src.length, dst.length), i;
	if (dst.array.constructor !== Array && n !== 0) {
		dst.array.set(src.array.subarray(src.offset, src.offset + n), dst.offset);
		return n;
	}
	for (i = 0; i < n; i++) {
		dst.array[dst.offset + i] = src.array[src.offset + i];
	}
	return n;
};

var go$copyString = function(dst, src) {
	var n = Math.min(src.length, dst.length), i;
	for (i = 0; i < n; i++) {
		dst.array[dst.offset + i] = src.charCodeAt(i);
	}
	return n;
};

var go$copyArray = function(dst, src) {
	var i;
	for (i = 0; i < src.length; i++) {
		dst[i] = src[i];
	}
};

var go$growSlice = function(slice, length) {
	var newCapacity = Math.max(length, slice.capacity < 1024 ? slice.capacity * 2 : Math.floor(slice.capacity * 5 / 4));

	var newArray;
	if (slice.array.constructor === Array) {
		newArray = slice.array;
		if (slice.offset !== 0 || newArray.length !== slice.offset + slice.capacity) {
			newArray = newArray.slice(slice.offset);
		}
		newArray.length = newCapacity;
	} else {
		newArray = new slice.array.constructor(newCapacity);
		newArray.set(slice.array.subarray(slice.offset));
	}

	var newSlice = new slice.constructor(newArray);
	newSlice.length = slice.length;
	newSlice.capacity = newCapacity;
	return newSlice;
};

var go$append = function(slice) {
	if (arguments.length === 1) {
		return slice;
	}

	var newLength = slice.length + arguments.length - 1;
	if (newLength > slice.capacity) {
		slice = go$growSlice(slice, newLength);
	}

	var array = slice.array;
	var leftOffset = slice.offset + slice.length - 1, i;
	for (i = 1; i < arguments.length; i++) {
		array[leftOffset + i] = arguments[i];
	}

	var newSlice = new slice.constructor(array);
	newSlice.offset = slice.offset;
	newSlice.length = newLength;
	newSlice.capacity = slice.capacity;
	return newSlice;
};

var go$appendSlice = function(slice, toAppend) {
	if (toAppend.length === 0) {
		return slice;
	}

	var newLength = slice.length + toAppend.length;
	if (newLength > slice.capacity) {
		slice = go$growSlice(slice, newLength);
	}

	var array = slice.array;
	var leftOffset = slice.offset + slice.length, rightOffset = toAppend.offset, i;
	for (i = 0; i < toAppend.length; i++) {
		array[leftOffset + i] = toAppend.array[rightOffset + i];
	}

	var newSlice = new slice.constructor(array);
	newSlice.offset = slice.offset;
	newSlice.length = newLength;
	newSlice.capacity = slice.capacity;
	return newSlice;
};

var go$panic = function(value) {
	var message;
	if (value.constructor === Go$String) {
		message = value.go$val;
	} else if (value.Error !== undefined) {
		message = value.Error();
	} else if (value.String !== undefined) {
		message = value.String();
	} else {
		message = value;
	}
	var err = new Error(message);
	err.go$panicValue = value;
	return err;
};
var go$notSupported = function(feature) {
	var err = new Error("not supported by GopherJS: " + feature + " (hint: the file optional.go.patch contains patches for core packages)");
	err.go$notSupported = feature;
	throw err;
};
var go$throwRuntimeError; // set by package "runtime"

var go$errorStack = [], go$jsErr = null;

var go$pushErr = function(err) {
	if (err.go$panicValue === undefined) {
		var jsPkg = go$packages["github.com/gopherjs/gopherjs/js"];
		if (err.go$notSupported !== undefined || jsPkg === undefined) {
			go$jsErr = err;
			return;
		}
		err.go$panicValue = new jsPkg.Error.Ptr(err);
	}
	go$errorStack.push({ frame: go$getStackDepth(), error: err });
};

var go$callDeferred = function(deferred) {
	if (go$jsErr !== null) {
		throw go$jsErr;
	}
	var i;
	for (i = deferred.length - 1; i >= 0; i--) {
		var call = deferred[i];
		try {
			if (call.recv !== undefined) {
				call.recv[call.method].apply(call.recv, call.args);
				continue;
			}
			call.fun.apply(undefined, call.args);
		} catch (err) {
			go$errorStack.push({ frame: go$getStackDepth(), error: err });
		}
	}
	var err = go$errorStack[go$errorStack.length - 1];
	if (err !== undefined && err.frame === go$getStackDepth()) {
		go$errorStack.pop();
		throw err.error;
	}
};

var go$recover = function() {
	var err = go$errorStack[go$errorStack.length - 1];
	if (err === undefined || err.frame !== go$getStackDepth()) {
		return null;
	}
	go$errorStack.pop();
	return err.error.go$panicValue;
};

var go$getStack = function() {
	return (new Error()).stack.split("\n");
};

var go$getStackDepth = function() {
	var s = go$getStack(), d = 0, i;
	for (i = 0; i < s.length; i++) {
		if (s[i].indexOf("go$") === -1) {
			d++;
		}
	}
	return d;
};

var go$interfaceIsEqual = function(a, b) {
	if (a === null || b === null) {
		return a === null && b === null;
	}
	if (a.constructor !== b.constructor) {
		return false;
	}
	switch (a.constructor.kind) {
	case "Float32":
		return go$float32bits(a.go$val) === go$float32bits(b.go$val);
	case "Complex64":
		return go$float32bits(a.go$val.real) === go$float32bits(b.go$val.real) && go$float32bits(a.go$val.imag) === go$float32bits(b.go$val.imag);
	case "Complex128":
		return a.go$val.real === b.go$val.real && a.go$val.imag === b.go$val.imag;
	case "Int64":
	case "Uint64":
		return a.go$val.high === b.go$val.high && a.go$val.low === b.go$val.low;
	case "Array":
		return go$arrayIsEqual(a.go$val, b.go$val);
	case "Ptr":
		if (a.constructor.Struct) {
			return a === b;
		}
		return go$pointerIsEqual(a, b);
	case "Func":
	case "Map":
	case "Slice":
	case "Struct":
		go$throwRuntimeError("comparing uncomparable type " + a.constructor);
	case undefined: // js.Object
		return a === b;
	default:
		return a.go$val === b.go$val;
	}
};
var go$arrayIsEqual = function(a, b) {
	if (a.length != b.length) {
		return false;
	}
	var i;
	for (i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			return false;
		}
	}
	return true;
};
var go$sliceIsEqual = function(a, ai, b, bi) {
	return a.array === b.array && a.offset + ai === b.offset + bi;
};
var go$pointerIsEqual = function(a, b) {
	if (a === b) {
		return true;
	}
	if (a.go$get === go$throwNilPointerError || b.go$get === go$throwNilPointerError) {
		return a.go$get === go$throwNilPointerError && b.go$get === go$throwNilPointerError;
	}
	var old = a.go$get();
	var dummy = new Object();
	a.go$set(dummy);
	var equal = b.go$get() === dummy;
	a.go$set(old);
	return equal;
};

var go$typeAssertionFailed = function(obj, expected) {
	var got = "nil";
	if (obj !== null) {
		got = obj.constructor.string;
	}
	throw go$panic("interface conversion: interface is " + got + ", not " + expected.string);
};

var go$now = function() { var msec = (new Date()).getTime(); return [new Go$Int64(0, Math.floor(msec / 1000)), (msec % 1000) * 1000000]; };

var go$packages = {};
go$packages["runtime"] = (function() {
	var go$pkg = {};
	var MemProfileRecord;
	MemProfileRecord = go$newType(0, "Struct", "runtime.MemProfileRecord", "MemProfileRecord", "runtime", function(AllocBytes_, FreeBytes_, AllocObjects_, FreeObjects_, Stack0_) {
		this.go$val = this;
		this.AllocBytes = AllocBytes_ !== undefined ? AllocBytes_ : new Go$Int64(0, 0);
		this.FreeBytes = FreeBytes_ !== undefined ? FreeBytes_ : new Go$Int64(0, 0);
		this.AllocObjects = AllocObjects_ !== undefined ? AllocObjects_ : new Go$Int64(0, 0);
		this.FreeObjects = FreeObjects_ !== undefined ? FreeObjects_ : new Go$Int64(0, 0);
		this.Stack0 = Stack0_ !== undefined ? Stack0_ : go$makeNativeArray("Uintptr", 32, function() { return 0; });
	});
	go$pkg.MemProfileRecord = MemProfileRecord;
	var StackRecord;
	StackRecord = go$newType(0, "Struct", "runtime.StackRecord", "StackRecord", "runtime", function(Stack0_) {
		this.go$val = this;
		this.Stack0 = Stack0_ !== undefined ? Stack0_ : go$makeNativeArray("Uintptr", 32, function() { return 0; });
	});
	go$pkg.StackRecord = StackRecord;
	var BlockProfileRecord;
	BlockProfileRecord = go$newType(0, "Struct", "runtime.BlockProfileRecord", "BlockProfileRecord", "runtime", function(Count_, Cycles_, StackRecord_) {
		this.go$val = this;
		this.Count = Count_ !== undefined ? Count_ : new Go$Int64(0, 0);
		this.Cycles = Cycles_ !== undefined ? Cycles_ : new Go$Int64(0, 0);
		this.StackRecord = StackRecord_ !== undefined ? StackRecord_ : new StackRecord.Ptr();
	});
	BlockProfileRecord.prototype.Stack = function() { return this.go$val.Stack(); };
	BlockProfileRecord.Ptr.prototype.Stack = function() { return this.StackRecord.Stack(); };
	go$pkg.BlockProfileRecord = BlockProfileRecord;
	var Error;
	Error = go$newType(0, "Interface", "runtime.Error", "Error", "runtime", null);
	go$pkg.Error = Error;
	var TypeAssertionError;
	TypeAssertionError = go$newType(0, "Struct", "runtime.TypeAssertionError", "TypeAssertionError", "runtime", function(interfaceString_, concreteString_, assertedString_, missingMethod_) {
		this.go$val = this;
		this.interfaceString = interfaceString_ !== undefined ? interfaceString_ : "";
		this.concreteString = concreteString_ !== undefined ? concreteString_ : "";
		this.assertedString = assertedString_ !== undefined ? assertedString_ : "";
		this.missingMethod = missingMethod_ !== undefined ? missingMethod_ : "";
	});
	go$pkg.TypeAssertionError = TypeAssertionError;
	var errorString;
	errorString = go$newType(0, "String", "runtime.errorString", "errorString", "runtime", null);
	go$pkg.errorString = errorString;
	var errorCString;
	errorCString = go$newType(4, "Uintptr", "runtime.errorCString", "errorCString", "runtime", null);
	go$pkg.errorCString = errorCString;
	var stringer;
	stringer = go$newType(0, "Interface", "runtime.stringer", "stringer", "runtime", null);
	go$pkg.stringer = stringer;
	var Func;
	Func = go$newType(0, "Struct", "runtime.Func", "Func", "runtime", function(opaque_) {
		this.go$val = this;
		this.opaque = opaque_ !== undefined ? opaque_ : new (go$structType([])).Ptr();
	});
	go$pkg.Func = Func;
	var MemStats;
	MemStats = go$newType(0, "Struct", "runtime.MemStats", "MemStats", "runtime", function(Alloc_, TotalAlloc_, Sys_, Lookups_, Mallocs_, Frees_, HeapAlloc_, HeapSys_, HeapIdle_, HeapInuse_, HeapReleased_, HeapObjects_, StackInuse_, StackSys_, MSpanInuse_, MSpanSys_, MCacheInuse_, MCacheSys_, BuckHashSys_, GCSys_, OtherSys_, NextGC_, LastGC_, PauseTotalNs_, PauseNs_, NumGC_, EnableGC_, DebugGC_, BySize_) {
		this.go$val = this;
		this.Alloc = Alloc_ !== undefined ? Alloc_ : new Go$Uint64(0, 0);
		this.TotalAlloc = TotalAlloc_ !== undefined ? TotalAlloc_ : new Go$Uint64(0, 0);
		this.Sys = Sys_ !== undefined ? Sys_ : new Go$Uint64(0, 0);
		this.Lookups = Lookups_ !== undefined ? Lookups_ : new Go$Uint64(0, 0);
		this.Mallocs = Mallocs_ !== undefined ? Mallocs_ : new Go$Uint64(0, 0);
		this.Frees = Frees_ !== undefined ? Frees_ : new Go$Uint64(0, 0);
		this.HeapAlloc = HeapAlloc_ !== undefined ? HeapAlloc_ : new Go$Uint64(0, 0);
		this.HeapSys = HeapSys_ !== undefined ? HeapSys_ : new Go$Uint64(0, 0);
		this.HeapIdle = HeapIdle_ !== undefined ? HeapIdle_ : new Go$Uint64(0, 0);
		this.HeapInuse = HeapInuse_ !== undefined ? HeapInuse_ : new Go$Uint64(0, 0);
		this.HeapReleased = HeapReleased_ !== undefined ? HeapReleased_ : new Go$Uint64(0, 0);
		this.HeapObjects = HeapObjects_ !== undefined ? HeapObjects_ : new Go$Uint64(0, 0);
		this.StackInuse = StackInuse_ !== undefined ? StackInuse_ : new Go$Uint64(0, 0);
		this.StackSys = StackSys_ !== undefined ? StackSys_ : new Go$Uint64(0, 0);
		this.MSpanInuse = MSpanInuse_ !== undefined ? MSpanInuse_ : new Go$Uint64(0, 0);
		this.MSpanSys = MSpanSys_ !== undefined ? MSpanSys_ : new Go$Uint64(0, 0);
		this.MCacheInuse = MCacheInuse_ !== undefined ? MCacheInuse_ : new Go$Uint64(0, 0);
		this.MCacheSys = MCacheSys_ !== undefined ? MCacheSys_ : new Go$Uint64(0, 0);
		this.BuckHashSys = BuckHashSys_ !== undefined ? BuckHashSys_ : new Go$Uint64(0, 0);
		this.GCSys = GCSys_ !== undefined ? GCSys_ : new Go$Uint64(0, 0);
		this.OtherSys = OtherSys_ !== undefined ? OtherSys_ : new Go$Uint64(0, 0);
		this.NextGC = NextGC_ !== undefined ? NextGC_ : new Go$Uint64(0, 0);
		this.LastGC = LastGC_ !== undefined ? LastGC_ : new Go$Uint64(0, 0);
		this.PauseTotalNs = PauseTotalNs_ !== undefined ? PauseTotalNs_ : new Go$Uint64(0, 0);
		this.PauseNs = PauseNs_ !== undefined ? PauseNs_ : go$makeNativeArray("Uint64", 256, function() { return new Go$Uint64(0, 0); });
		this.NumGC = NumGC_ !== undefined ? NumGC_ : 0;
		this.EnableGC = EnableGC_ !== undefined ? EnableGC_ : false;
		this.DebugGC = DebugGC_ !== undefined ? DebugGC_ : false;
		this.BySize = BySize_ !== undefined ? BySize_ : go$makeNativeArray("Struct", 61, function() { return new (go$structType([["Size", "", Go$Uint32, ""], ["Mallocs", "", Go$Uint64, ""], ["Frees", "", Go$Uint64, ""]])).Ptr(0, new Go$Uint64(0, 0), new Go$Uint64(0, 0)); });
	});
	go$pkg.MemStats = MemStats;
	var rtype;
	rtype = go$newType(0, "Struct", "runtime.rtype", "rtype", "runtime", function(size_, hash_, _$2_, align_, fieldAlign_, kind_, alg_, gc_, string_, uncommonType_, ptrToThis_) {
		this.go$val = this;
		this.size = size_ !== undefined ? size_ : 0;
		this.hash = hash_ !== undefined ? hash_ : 0;
		this._$2 = _$2_ !== undefined ? _$2_ : 0;
		this.align = align_ !== undefined ? align_ : 0;
		this.fieldAlign = fieldAlign_ !== undefined ? fieldAlign_ : 0;
		this.kind = kind_ !== undefined ? kind_ : 0;
		this.alg = alg_ !== undefined ? alg_ : 0;
		this.gc = gc_ !== undefined ? gc_ : 0;
		this.string = string_ !== undefined ? string_ : (go$ptrType(Go$String)).nil;
		this.uncommonType = uncommonType_ !== undefined ? uncommonType_ : (go$ptrType(uncommonType)).nil;
		this.ptrToThis = ptrToThis_ !== undefined ? ptrToThis_ : (go$ptrType(rtype)).nil;
	});
	go$pkg.rtype = rtype;
	var _method;
	_method = go$newType(0, "Struct", "runtime._method", "_method", "runtime", function(name_, pkgPath_, mtyp_, typ_, ifn_, tfn_) {
		this.go$val = this;
		this.name = name_ !== undefined ? name_ : (go$ptrType(Go$String)).nil;
		this.pkgPath = pkgPath_ !== undefined ? pkgPath_ : (go$ptrType(Go$String)).nil;
		this.mtyp = mtyp_ !== undefined ? mtyp_ : (go$ptrType(rtype)).nil;
		this.typ = typ_ !== undefined ? typ_ : (go$ptrType(rtype)).nil;
		this.ifn = ifn_ !== undefined ? ifn_ : 0;
		this.tfn = tfn_ !== undefined ? tfn_ : 0;
	});
	go$pkg._method = _method;
	var uncommonType;
	uncommonType = go$newType(0, "Struct", "runtime.uncommonType", "uncommonType", "runtime", function(name_, pkgPath_, methods_) {
		this.go$val = this;
		this.name = name_ !== undefined ? name_ : (go$ptrType(Go$String)).nil;
		this.pkgPath = pkgPath_ !== undefined ? pkgPath_ : (go$ptrType(Go$String)).nil;
		this.methods = methods_ !== undefined ? methods_ : (go$sliceType(_method)).nil;
	});
	go$pkg.uncommonType = uncommonType;
	var _imethod;
	_imethod = go$newType(0, "Struct", "runtime._imethod", "_imethod", "runtime", function(name_, pkgPath_, typ_) {
		this.go$val = this;
		this.name = name_ !== undefined ? name_ : (go$ptrType(Go$String)).nil;
		this.pkgPath = pkgPath_ !== undefined ? pkgPath_ : (go$ptrType(Go$String)).nil;
		this.typ = typ_ !== undefined ? typ_ : (go$ptrType(rtype)).nil;
	});
	go$pkg._imethod = _imethod;
	var interfaceType;
	interfaceType = go$newType(0, "Struct", "runtime.interfaceType", "interfaceType", "runtime", function(rtype_, methods_) {
		this.go$val = this;
		this.rtype = rtype_ !== undefined ? rtype_ : new rtype.Ptr();
		this.methods = methods_ !== undefined ? methods_ : (go$sliceType(_imethod)).nil;
	});
	go$pkg.interfaceType = interfaceType;
	var lock;
	lock = go$newType(0, "Struct", "runtime.lock", "lock", "runtime", function(key_) {
		this.go$val = this;
		this.key = key_ !== undefined ? key_ : new Go$Uint64(0, 0);
	});
	go$pkg.lock = lock;
	var note;
	note = go$newType(0, "Struct", "runtime.note", "note", "runtime", function(key_) {
		this.go$val = this;
		this.key = key_ !== undefined ? key_ : new Go$Uint64(0, 0);
	});
	go$pkg.note = note;
	var _string;
	_string = go$newType(0, "Struct", "runtime._string", "_string", "runtime", function(str_, len_) {
		this.go$val = this;
		this.str = str_ !== undefined ? str_ : (go$ptrType(Go$Uint8)).nil;
		this.len = len_ !== undefined ? len_ : new Go$Int64(0, 0);
	});
	go$pkg._string = _string;
	var funcval;
	funcval = go$newType(0, "Struct", "runtime.funcval", "funcval", "runtime", function(fn_) {
		this.go$val = this;
		this.fn = fn_ !== undefined ? fn_ : go$throwNilPointerError;
	});
	go$pkg.funcval = funcval;
	var iface;
	iface = go$newType(0, "Struct", "runtime.iface", "iface", "runtime", function(tab_, data_) {
		this.go$val = this;
		this.tab = tab_ !== undefined ? tab_ : (go$ptrType(itab)).nil;
		this.data = data_ !== undefined ? data_ : 0;
	});
	go$pkg.iface = iface;
	var eface;
	eface = go$newType(0, "Struct", "runtime.eface", "eface", "runtime", function(_type_, data_) {
		this.go$val = this;
		this._type = _type_ !== undefined ? _type_ : (go$ptrType(_type)).nil;
		this.data = data_ !== undefined ? data_ : 0;
	});
	go$pkg.eface = eface;
	var _complex64;
	_complex64 = go$newType(0, "Struct", "runtime._complex64", "_complex64", "runtime", function(real_, imag_) {
		this.go$val = this;
		this.real = real_ !== undefined ? real_ : 0;
		this.imag = imag_ !== undefined ? imag_ : 0;
	});
	go$pkg._complex64 = _complex64;
	var _complex128;
	_complex128 = go$newType(0, "Struct", "runtime._complex128", "_complex128", "runtime", function(real_, imag_) {
		this.go$val = this;
		this.real = real_ !== undefined ? real_ : 0;
		this.imag = imag_ !== undefined ? imag_ : 0;
	});
	go$pkg._complex128 = _complex128;
	var slice;
	slice = go$newType(0, "Struct", "runtime.slice", "slice", "runtime", function(array_, len_, cap_) {
		this.go$val = this;
		this.array = array_ !== undefined ? array_ : (go$ptrType(Go$Uint8)).nil;
		this.len = len_ !== undefined ? len_ : new Go$Uint64(0, 0);
		this.cap = cap_ !== undefined ? cap_ : new Go$Uint64(0, 0);
	});
	go$pkg.slice = slice;
	var gobuf;
	gobuf = go$newType(0, "Struct", "runtime.gobuf", "gobuf", "runtime", function(sp_, pc_, g_, ret_, ctxt_, lr_) {
		this.go$val = this;
		this.sp = sp_ !== undefined ? sp_ : new Go$Uint64(0, 0);
		this.pc = pc_ !== undefined ? pc_ : new Go$Uint64(0, 0);
		this.g = g_ !== undefined ? g_ : (go$ptrType(g)).nil;
		this.ret = ret_ !== undefined ? ret_ : new Go$Uint64(0, 0);
		this.ctxt = ctxt_ !== undefined ? ctxt_ : 0;
		this.lr = lr_ !== undefined ? lr_ : new Go$Uint64(0, 0);
	});
	go$pkg.gobuf = gobuf;
	var gcstats;
	gcstats = go$newType(0, "Struct", "runtime.gcstats", "gcstats", "runtime", function(nhandoff_, nhandoffcnt_, nprocyield_, nosyield_, nsleep_) {
		this.go$val = this;
		this.nhandoff = nhandoff_ !== undefined ? nhandoff_ : new Go$Uint64(0, 0);
		this.nhandoffcnt = nhandoffcnt_ !== undefined ? nhandoffcnt_ : new Go$Uint64(0, 0);
		this.nprocyield = nprocyield_ !== undefined ? nprocyield_ : new Go$Uint64(0, 0);
		this.nosyield = nosyield_ !== undefined ? nosyield_ : new Go$Uint64(0, 0);
		this.nsleep = nsleep_ !== undefined ? nsleep_ : new Go$Uint64(0, 0);
	});
	go$pkg.gcstats = gcstats;
	var wincall;
	wincall = go$newType(0, "Struct", "runtime.wincall", "wincall", "runtime", function(fn_, n_, args_, r1_, r2_, err_) {
		this.go$val = this;
		this.fn = fn_ !== undefined ? fn_ : go$throwNilPointerError;
		this.n = n_ !== undefined ? n_ : new Go$Uint64(0, 0);
		this.args = args_ !== undefined ? args_ : 0;
		this.r1 = r1_ !== undefined ? r1_ : new Go$Uint64(0, 0);
		this.r2 = r2_ !== undefined ? r2_ : new Go$Uint64(0, 0);
		this.err = err_ !== undefined ? err_ : new Go$Uint64(0, 0);
	});
	go$pkg.wincall = wincall;
	var seh;
	seh = go$newType(0, "Struct", "runtime.seh", "seh", "runtime", function(prev_, handler_) {
		this.go$val = this;
		this.prev = prev_ !== undefined ? prev_ : 0;
		this.handler = handler_ !== undefined ? handler_ : 0;
	});
	go$pkg.seh = seh;
	var wincallbackcontext;
	wincallbackcontext = go$newType(0, "Struct", "runtime.wincallbackcontext", "wincallbackcontext", "runtime", function(gobody_, argsize_, restorestack_) {
		this.go$val = this;
		this.gobody = gobody_ !== undefined ? gobody_ : 0;
		this.argsize = argsize_ !== undefined ? argsize_ : new Go$Uint64(0, 0);
		this.restorestack = restorestack_ !== undefined ? restorestack_ : new Go$Uint64(0, 0);
	});
	go$pkg.wincallbackcontext = wincallbackcontext;
	var g;
	g = go$newType(0, "Struct", "runtime.g", "g", "runtime", function(stackguard0_, stackbase_, panicwrap_, selgen_, _defer_, _panic_, sched_, syscallstack_, syscallsp_, syscallpc_, syscallguard_, stackguard_, stack0_, stacksize_, alllink_, param_, status_, goid_, waitreason_, schedlink_, ispanic_, issystem_, isbackground_, preempt_, raceignore_, m_, lockedm_, sig_, writenbuf_, writebuf_, dchunk_, dchunknext_, sigcode0_, sigcode1_, sigpc_, gopc_, racectx_, end_) {
		this.go$val = this;
		this.stackguard0 = stackguard0_ !== undefined ? stackguard0_ : new Go$Uint64(0, 0);
		this.stackbase = stackbase_ !== undefined ? stackbase_ : new Go$Uint64(0, 0);
		this.panicwrap = panicwrap_ !== undefined ? panicwrap_ : 0;
		this.selgen = selgen_ !== undefined ? selgen_ : 0;
		this._defer = _defer_ !== undefined ? _defer_ : (go$ptrType(_defer)).nil;
		this._panic = _panic_ !== undefined ? _panic_ : (go$ptrType(_panic)).nil;
		this.sched = sched_ !== undefined ? sched_ : new gobuf.Ptr();
		this.syscallstack = syscallstack_ !== undefined ? syscallstack_ : new Go$Uint64(0, 0);
		this.syscallsp = syscallsp_ !== undefined ? syscallsp_ : new Go$Uint64(0, 0);
		this.syscallpc = syscallpc_ !== undefined ? syscallpc_ : new Go$Uint64(0, 0);
		this.syscallguard = syscallguard_ !== undefined ? syscallguard_ : new Go$Uint64(0, 0);
		this.stackguard = stackguard_ !== undefined ? stackguard_ : new Go$Uint64(0, 0);
		this.stack0 = stack0_ !== undefined ? stack0_ : new Go$Uint64(0, 0);
		this.stacksize = stacksize_ !== undefined ? stacksize_ : new Go$Uint64(0, 0);
		this.alllink = alllink_ !== undefined ? alllink_ : (go$ptrType(g)).nil;
		this.param = param_ !== undefined ? param_ : 0;
		this.status = status_ !== undefined ? status_ : 0;
		this.goid = goid_ !== undefined ? goid_ : new Go$Int64(0, 0);
		this.waitreason = waitreason_ !== undefined ? waitreason_ : (go$ptrType(Go$Int8)).nil;
		this.schedlink = schedlink_ !== undefined ? schedlink_ : (go$ptrType(g)).nil;
		this.ispanic = ispanic_ !== undefined ? ispanic_ : 0;
		this.issystem = issystem_ !== undefined ? issystem_ : 0;
		this.isbackground = isbackground_ !== undefined ? isbackground_ : 0;
		this.preempt = preempt_ !== undefined ? preempt_ : 0;
		this.raceignore = raceignore_ !== undefined ? raceignore_ : 0;
		this.m = m_ !== undefined ? m_ : (go$ptrType(m)).nil;
		this.lockedm = lockedm_ !== undefined ? lockedm_ : (go$ptrType(m)).nil;
		this.sig = sig_ !== undefined ? sig_ : 0;
		this.writenbuf = writenbuf_ !== undefined ? writenbuf_ : 0;
		this.writebuf = writebuf_ !== undefined ? writebuf_ : (go$ptrType(Go$Uint8)).nil;
		this.dchunk = dchunk_ !== undefined ? dchunk_ : (go$ptrType(deferchunk)).nil;
		this.dchunknext = dchunknext_ !== undefined ? dchunknext_ : (go$ptrType(deferchunk)).nil;
		this.sigcode0 = sigcode0_ !== undefined ? sigcode0_ : new Go$Uint64(0, 0);
		this.sigcode1 = sigcode1_ !== undefined ? sigcode1_ : new Go$Uint64(0, 0);
		this.sigpc = sigpc_ !== undefined ? sigpc_ : new Go$Uint64(0, 0);
		this.gopc = gopc_ !== undefined ? gopc_ : new Go$Uint64(0, 0);
		this.racectx = racectx_ !== undefined ? racectx_ : new Go$Uint64(0, 0);
		this.end = end_ !== undefined ? end_ : go$makeNativeArray("Uint64", 0, function() { return new Go$Uint64(0, 0); });
	});
	go$pkg.g = g;
	var m;
	m = go$newType(0, "Struct", "runtime.m", "m", "runtime", function(g0_, moreargp_, morebuf_, moreframesize_, moreargsize_, cret_, procid_, gsignal_, tls_, mstartfn_, curg_, caughtsig_, p_, nextp_, id_, mallocing_, throwing_, gcing_, locks_, dying_, profilehz_, helpgc_, spinning_, fastrand_, ncgocall_, ncgo_, cgomal_, park_, alllink_, schedlink_, machport_, mcache_, stackinuse_, stackcachepos_, stackcachecnt_, stackcache_, lockedg_, createstack_, freglo_, freghi_, fflag_, locked_, nextwaitm_, waitsema_, waitsemacount_, waitsemalock_, gcstats_, racecall_, needextram_, waitunlockf_, waitlock_, settype_buf_, settype_bufsize_, thread_, wincall_, seh_, end_) {
		this.go$val = this;
		this.g0 = g0_ !== undefined ? g0_ : (go$ptrType(g)).nil;
		this.moreargp = moreargp_ !== undefined ? moreargp_ : 0;
		this.morebuf = morebuf_ !== undefined ? morebuf_ : new gobuf.Ptr();
		this.moreframesize = moreframesize_ !== undefined ? moreframesize_ : 0;
		this.moreargsize = moreargsize_ !== undefined ? moreargsize_ : 0;
		this.cret = cret_ !== undefined ? cret_ : new Go$Uint64(0, 0);
		this.procid = procid_ !== undefined ? procid_ : new Go$Uint64(0, 0);
		this.gsignal = gsignal_ !== undefined ? gsignal_ : (go$ptrType(g)).nil;
		this.tls = tls_ !== undefined ? tls_ : go$makeNativeArray("Uint64", 4, function() { return new Go$Uint64(0, 0); });
		this.mstartfn = mstartfn_ !== undefined ? mstartfn_ : go$throwNilPointerError;
		this.curg = curg_ !== undefined ? curg_ : (go$ptrType(g)).nil;
		this.caughtsig = caughtsig_ !== undefined ? caughtsig_ : (go$ptrType(g)).nil;
		this.p = p_ !== undefined ? p_ : (go$ptrType(p)).nil;
		this.nextp = nextp_ !== undefined ? nextp_ : (go$ptrType(p)).nil;
		this.id = id_ !== undefined ? id_ : 0;
		this.mallocing = mallocing_ !== undefined ? mallocing_ : 0;
		this.throwing = throwing_ !== undefined ? throwing_ : 0;
		this.gcing = gcing_ !== undefined ? gcing_ : 0;
		this.locks = locks_ !== undefined ? locks_ : 0;
		this.dying = dying_ !== undefined ? dying_ : 0;
		this.profilehz = profilehz_ !== undefined ? profilehz_ : 0;
		this.helpgc = helpgc_ !== undefined ? helpgc_ : 0;
		this.spinning = spinning_ !== undefined ? spinning_ : 0;
		this.fastrand = fastrand_ !== undefined ? fastrand_ : 0;
		this.ncgocall = ncgocall_ !== undefined ? ncgocall_ : new Go$Uint64(0, 0);
		this.ncgo = ncgo_ !== undefined ? ncgo_ : 0;
		this.cgomal = cgomal_ !== undefined ? cgomal_ : (go$ptrType(cgomal)).nil;
		this.park = park_ !== undefined ? park_ : new note.Ptr();
		this.alllink = alllink_ !== undefined ? alllink_ : (go$ptrType(m)).nil;
		this.schedlink = schedlink_ !== undefined ? schedlink_ : (go$ptrType(m)).nil;
		this.machport = machport_ !== undefined ? machport_ : 0;
		this.mcache = mcache_ !== undefined ? mcache_ : (go$ptrType(mcache)).nil;
		this.stackinuse = stackinuse_ !== undefined ? stackinuse_ : 0;
		this.stackcachepos = stackcachepos_ !== undefined ? stackcachepos_ : 0;
		this.stackcachecnt = stackcachecnt_ !== undefined ? stackcachecnt_ : 0;
		this.stackcache = stackcache_ !== undefined ? stackcache_ : go$makeNativeArray("UnsafePointer", 32, function() { return 0; });
		this.lockedg = lockedg_ !== undefined ? lockedg_ : (go$ptrType(g)).nil;
		this.createstack = createstack_ !== undefined ? createstack_ : go$makeNativeArray("Uint64", 32, function() { return new Go$Uint64(0, 0); });
		this.freglo = freglo_ !== undefined ? freglo_ : go$makeNativeArray("Uint32", 16, function() { return 0; });
		this.freghi = freghi_ !== undefined ? freghi_ : go$makeNativeArray("Uint32", 16, function() { return 0; });
		this.fflag = fflag_ !== undefined ? fflag_ : 0;
		this.locked = locked_ !== undefined ? locked_ : 0;
		this.nextwaitm = nextwaitm_ !== undefined ? nextwaitm_ : (go$ptrType(m)).nil;
		this.waitsema = waitsema_ !== undefined ? waitsema_ : new Go$Uint64(0, 0);
		this.waitsemacount = waitsemacount_ !== undefined ? waitsemacount_ : 0;
		this.waitsemalock = waitsemalock_ !== undefined ? waitsemalock_ : 0;
		this.gcstats = gcstats_ !== undefined ? gcstats_ : new gcstats.Ptr();
		this.racecall = racecall_ !== undefined ? racecall_ : 0;
		this.needextram = needextram_ !== undefined ? needextram_ : 0;
		this.waitunlockf = waitunlockf_ !== undefined ? waitunlockf_ : go$throwNilPointerError;
		this.waitlock = waitlock_ !== undefined ? waitlock_ : 0;
		this.settype_buf = settype_buf_ !== undefined ? settype_buf_ : go$makeNativeArray("Uint64", 1024, function() { return new Go$Uint64(0, 0); });
		this.settype_bufsize = settype_bufsize_ !== undefined ? settype_bufsize_ : new Go$Uint64(0, 0);
		this.thread = thread_ !== undefined ? thread_ : 0;
		this.wincall = wincall_ !== undefined ? wincall_ : new wincall.Ptr();
		this.seh = seh_ !== undefined ? seh_ : (go$ptrType(seh)).nil;
		this.end = end_ !== undefined ? end_ : go$makeNativeArray("Uint64", 0, function() { return new Go$Uint64(0, 0); });
	});
	go$pkg.m = m;
	var p;
	p = go$newType(0, "Struct", "runtime.p", "p", "runtime", function(lock_, id_, status_, link_, schedtick_, syscalltick_, m_, mcache_, runq_, runqhead_, runqtail_, runqsize_, gfree_, gfreecnt_, pad_) {
		this.go$val = this;
		this.lock = lock_ !== undefined ? lock_ : new lock.Ptr();
		this.id = id_ !== undefined ? id_ : 0;
		this.status = status_ !== undefined ? status_ : 0;
		this.link = link_ !== undefined ? link_ : (go$ptrType(p)).nil;
		this.schedtick = schedtick_ !== undefined ? schedtick_ : 0;
		this.syscalltick = syscalltick_ !== undefined ? syscalltick_ : 0;
		this.m = m_ !== undefined ? m_ : (go$ptrType(m)).nil;
		this.mcache = mcache_ !== undefined ? mcache_ : (go$ptrType(mcache)).nil;
		this.runq = runq_ !== undefined ? runq_ : (go$ptrType((go$ptrType(g)))).nil;
		this.runqhead = runqhead_ !== undefined ? runqhead_ : 0;
		this.runqtail = runqtail_ !== undefined ? runqtail_ : 0;
		this.runqsize = runqsize_ !== undefined ? runqsize_ : 0;
		this.gfree = gfree_ !== undefined ? gfree_ : (go$ptrType(g)).nil;
		this.gfreecnt = gfreecnt_ !== undefined ? gfreecnt_ : 0;
		this.pad = pad_ !== undefined ? pad_ : go$makeNativeArray("Uint8", 64, function() { return 0; });
	});
	go$pkg.p = p;
	var stktop;
	stktop = go$newType(0, "Struct", "runtime.stktop", "stktop", "runtime", function(stackguard_, stackbase_, gobuf_, argsize_, panicwrap_, argp_, free_, _panic_) {
		this.go$val = this;
		this.stackguard = stackguard_ !== undefined ? stackguard_ : new Go$Uint64(0, 0);
		this.stackbase = stackbase_ !== undefined ? stackbase_ : new Go$Uint64(0, 0);
		this.gobuf = gobuf_ !== undefined ? gobuf_ : new gobuf.Ptr();
		this.argsize = argsize_ !== undefined ? argsize_ : 0;
		this.panicwrap = panicwrap_ !== undefined ? panicwrap_ : 0;
		this.argp = argp_ !== undefined ? argp_ : (go$ptrType(Go$Uint8)).nil;
		this.free = free_ !== undefined ? free_ : new Go$Uint64(0, 0);
		this._panic = _panic_ !== undefined ? _panic_ : 0;
	});
	go$pkg.stktop = stktop;
	var sigtab;
	sigtab = go$newType(0, "Struct", "runtime.sigtab", "sigtab", "runtime", function(flags_, name_) {
		this.go$val = this;
		this.flags = flags_ !== undefined ? flags_ : 0;
		this.name = name_ !== undefined ? name_ : (go$ptrType(Go$Int8)).nil;
	});
	go$pkg.sigtab = sigtab;
	var _func;
	_func = go$newType(0, "Struct", "runtime._func", "_func", "runtime", function(entry_, nameoff_, args_, frame_, pcsp_, pcfile_, pcln_, npcdata_, nfuncdata_) {
		this.go$val = this;
		this.entry = entry_ !== undefined ? entry_ : new Go$Uint64(0, 0);
		this.nameoff = nameoff_ !== undefined ? nameoff_ : 0;
		this.args = args_ !== undefined ? args_ : 0;
		this.frame = frame_ !== undefined ? frame_ : 0;
		this.pcsp = pcsp_ !== undefined ? pcsp_ : 0;
		this.pcfile = pcfile_ !== undefined ? pcfile_ : 0;
		this.pcln = pcln_ !== undefined ? pcln_ : 0;
		this.npcdata = npcdata_ !== undefined ? npcdata_ : 0;
		this.nfuncdata = nfuncdata_ !== undefined ? nfuncdata_ : 0;
	});
	go$pkg._func = _func;
	var itab;
	itab = go$newType(0, "Struct", "runtime.itab", "itab", "runtime", function(inter_, _type_, link_, bad_, unused_, fun_) {
		this.go$val = this;
		this.inter = inter_ !== undefined ? inter_ : (go$ptrType(interfacetype)).nil;
		this._type = _type_ !== undefined ? _type_ : (go$ptrType(_type)).nil;
		this.link = link_ !== undefined ? link_ : (go$ptrType(itab)).nil;
		this.bad = bad_ !== undefined ? bad_ : 0;
		this.unused = unused_ !== undefined ? unused_ : 0;
		this.fun = fun_ !== undefined ? fun_ : go$makeNativeArray("Func", 0, function() { return go$throwNilPointerError; });
	});
	go$pkg.itab = itab;
	var timers;
	timers = go$newType(0, "Struct", "runtime.timers", "timers", "runtime", function(lock_, timerproc_, sleeping_, rescheduling_, waitnote_, t_, len_, cap_) {
		this.go$val = this;
		this.lock = lock_ !== undefined ? lock_ : new lock.Ptr();
		this.timerproc = timerproc_ !== undefined ? timerproc_ : (go$ptrType(g)).nil;
		this.sleeping = sleeping_ !== undefined ? sleeping_ : 0;
		this.rescheduling = rescheduling_ !== undefined ? rescheduling_ : 0;
		this.waitnote = waitnote_ !== undefined ? waitnote_ : new note.Ptr();
		this.t = t_ !== undefined ? t_ : (go$ptrType((go$ptrType(timer)))).nil;
		this.len = len_ !== undefined ? len_ : 0;
		this.cap = cap_ !== undefined ? cap_ : 0;
	});
	go$pkg.timers = timers;
	var timer;
	timer = go$newType(0, "Struct", "runtime.timer", "timer", "runtime", function(i_, when_, period_, fv_, arg_) {
		this.go$val = this;
		this.i = i_ !== undefined ? i_ : 0;
		this.when = when_ !== undefined ? when_ : new Go$Int64(0, 0);
		this.period = period_ !== undefined ? period_ : new Go$Int64(0, 0);
		this.fv = fv_ !== undefined ? fv_ : (go$ptrType(funcval)).nil;
		this.arg = arg_ !== undefined ? arg_ : new eface.Ptr();
	});
	go$pkg.timer = timer;
	var lfnode;
	lfnode = go$newType(0, "Struct", "runtime.lfnode", "lfnode", "runtime", function(next_, pushcnt_) {
		this.go$val = this;
		this.next = next_ !== undefined ? next_ : (go$ptrType(lfnode)).nil;
		this.pushcnt = pushcnt_ !== undefined ? pushcnt_ : new Go$Uint64(0, 0);
	});
	go$pkg.lfnode = lfnode;
	var parfor;
	parfor = go$newType(0, "Struct", "runtime.parfor", "parfor", "runtime", function(body_, done_, nthr_, nthrmax_, thrseq_, cnt_, ctx_, wait_, thr_, pad_, nsteal_, nstealcnt_, nprocyield_, nosyield_, nsleep_) {
		this.go$val = this;
		this.body = body_ !== undefined ? body_ : go$throwNilPointerError;
		this.done = done_ !== undefined ? done_ : 0;
		this.nthr = nthr_ !== undefined ? nthr_ : 0;
		this.nthrmax = nthrmax_ !== undefined ? nthrmax_ : 0;
		this.thrseq = thrseq_ !== undefined ? thrseq_ : 0;
		this.cnt = cnt_ !== undefined ? cnt_ : 0;
		this.ctx = ctx_ !== undefined ? ctx_ : 0;
		this.wait = wait_ !== undefined ? wait_ : 0;
		this.thr = thr_ !== undefined ? thr_ : (go$ptrType(parforthread)).nil;
		this.pad = pad_ !== undefined ? pad_ : 0;
		this.nsteal = nsteal_ !== undefined ? nsteal_ : new Go$Uint64(0, 0);
		this.nstealcnt = nstealcnt_ !== undefined ? nstealcnt_ : new Go$Uint64(0, 0);
		this.nprocyield = nprocyield_ !== undefined ? nprocyield_ : new Go$Uint64(0, 0);
		this.nosyield = nosyield_ !== undefined ? nosyield_ : new Go$Uint64(0, 0);
		this.nsleep = nsleep_ !== undefined ? nsleep_ : new Go$Uint64(0, 0);
	});
	go$pkg.parfor = parfor;
	var cgomal;
	cgomal = go$newType(0, "Struct", "runtime.cgomal", "cgomal", "runtime", function(next_, alloc_) {
		this.go$val = this;
		this.next = next_ !== undefined ? next_ : (go$ptrType(cgomal)).nil;
		this.alloc = alloc_ !== undefined ? alloc_ : 0;
	});
	go$pkg.cgomal = cgomal;
	var debugvars;
	debugvars = go$newType(0, "Struct", "runtime.debugvars", "debugvars", "runtime", function(gctrace_, schedtrace_, scheddetail_) {
		this.go$val = this;
		this.gctrace = gctrace_ !== undefined ? gctrace_ : 0;
		this.schedtrace = schedtrace_ !== undefined ? schedtrace_ : 0;
		this.scheddetail = scheddetail_ !== undefined ? scheddetail_ : 0;
	});
	go$pkg.debugvars = debugvars;
	var alg;
	alg = go$newType(0, "Struct", "runtime.alg", "alg", "runtime", function(hash_, equal_, print_, copy_) {
		this.go$val = this;
		this.hash = hash_ !== undefined ? hash_ : go$throwNilPointerError;
		this.equal = equal_ !== undefined ? equal_ : go$throwNilPointerError;
		this.print = print_ !== undefined ? print_ : go$throwNilPointerError;
		this.copy = copy_ !== undefined ? copy_ : go$throwNilPointerError;
	});
	go$pkg.alg = alg;
	var _defer;
	_defer = go$newType(0, "Struct", "runtime._defer", "_defer", "runtime", function(siz_, special_, free_, argp_, pc_, fn_, link_, args_) {
		this.go$val = this;
		this.siz = siz_ !== undefined ? siz_ : 0;
		this.special = special_ !== undefined ? special_ : 0;
		this.free = free_ !== undefined ? free_ : 0;
		this.argp = argp_ !== undefined ? argp_ : (go$ptrType(Go$Uint8)).nil;
		this.pc = pc_ !== undefined ? pc_ : (go$ptrType(Go$Uint8)).nil;
		this.fn = fn_ !== undefined ? fn_ : (go$ptrType(funcval)).nil;
		this.link = link_ !== undefined ? link_ : (go$ptrType(_defer)).nil;
		this.args = args_ !== undefined ? args_ : go$makeNativeArray("UnsafePointer", 1, function() { return 0; });
	});
	go$pkg._defer = _defer;
	var deferchunk;
	deferchunk = go$newType(0, "Struct", "runtime.deferchunk", "deferchunk", "runtime", function(prev_, off_) {
		this.go$val = this;
		this.prev = prev_ !== undefined ? prev_ : (go$ptrType(deferchunk)).nil;
		this.off = off_ !== undefined ? off_ : new Go$Uint64(0, 0);
	});
	go$pkg.deferchunk = deferchunk;
	var _panic;
	_panic = go$newType(0, "Struct", "runtime._panic", "_panic", "runtime", function(arg_, stackbase_, link_, recovered_) {
		this.go$val = this;
		this.arg = arg_ !== undefined ? arg_ : new eface.Ptr();
		this.stackbase = stackbase_ !== undefined ? stackbase_ : new Go$Uint64(0, 0);
		this.link = link_ !== undefined ? link_ : (go$ptrType(_panic)).nil;
		this.recovered = recovered_ !== undefined ? recovered_ : 0;
	});
	go$pkg._panic = _panic;
	var stkframe;
	stkframe = go$newType(0, "Struct", "runtime.stkframe", "stkframe", "runtime", function(fn_, pc_, lr_, sp_, fp_, varp_, argp_, arglen_) {
		this.go$val = this;
		this.fn = fn_ !== undefined ? fn_ : (go$ptrType(_func)).nil;
		this.pc = pc_ !== undefined ? pc_ : new Go$Uint64(0, 0);
		this.lr = lr_ !== undefined ? lr_ : new Go$Uint64(0, 0);
		this.sp = sp_ !== undefined ? sp_ : new Go$Uint64(0, 0);
		this.fp = fp_ !== undefined ? fp_ : new Go$Uint64(0, 0);
		this.varp = varp_ !== undefined ? varp_ : (go$ptrType(Go$Uint8)).nil;
		this.argp = argp_ !== undefined ? argp_ : (go$ptrType(Go$Uint8)).nil;
		this.arglen = arglen_ !== undefined ? arglen_ : new Go$Uint64(0, 0);
	});
	go$pkg.stkframe = stkframe;
	var mlink;
	mlink = go$newType(0, "Struct", "runtime.mlink", "mlink", "runtime", function(next_) {
		this.go$val = this;
		this.next = next_ !== undefined ? next_ : (go$ptrType(mlink)).nil;
	});
	go$pkg.mlink = mlink;
	var fixalloc;
	fixalloc = go$newType(0, "Struct", "runtime.fixalloc", "fixalloc", "runtime", function(size_, first_, arg_, list_, chunk_, nchunk_, inuse_, stat_) {
		this.go$val = this;
		this.size = size_ !== undefined ? size_ : new Go$Uint64(0, 0);
		this.first = first_ !== undefined ? first_ : go$throwNilPointerError;
		this.arg = arg_ !== undefined ? arg_ : 0;
		this.list = list_ !== undefined ? list_ : (go$ptrType(mlink)).nil;
		this.chunk = chunk_ !== undefined ? chunk_ : (go$ptrType(Go$Uint8)).nil;
		this.nchunk = nchunk_ !== undefined ? nchunk_ : 0;
		this.inuse = inuse_ !== undefined ? inuse_ : new Go$Uint64(0, 0);
		this.stat = stat_ !== undefined ? stat_ : (go$ptrType(Go$Uint64)).nil;
	});
	go$pkg.fixalloc = fixalloc;
	var _1_;
	_1_ = go$newType(0, "Struct", "runtime._1_", "_1_", "runtime", function(size_, nmalloc_, nfree_) {
		this.go$val = this;
		this.size = size_ !== undefined ? size_ : 0;
		this.nmalloc = nmalloc_ !== undefined ? nmalloc_ : new Go$Uint64(0, 0);
		this.nfree = nfree_ !== undefined ? nfree_ : new Go$Uint64(0, 0);
	});
	go$pkg._1_ = _1_;
	var mstats;
	mstats = go$newType(0, "Struct", "runtime.mstats", "mstats", "runtime", function(alloc_, total_alloc_, sys_, nlookup_, nmalloc_, nfree_, heap_alloc_, heap_sys_, heap_idle_, heap_inuse_, heap_released_, heap_objects_, stacks_inuse_, stacks_sys_, mspan_inuse_, mspan_sys_, mcache_inuse_, mcache_sys_, buckhash_sys_, gc_sys_, other_sys_, next_gc_, last_gc_, pause_total_ns_, pause_ns_, numgc_, enablegc_, debuggc_, by_size_) {
		this.go$val = this;
		this.alloc = alloc_ !== undefined ? alloc_ : new Go$Uint64(0, 0);
		this.total_alloc = total_alloc_ !== undefined ? total_alloc_ : new Go$Uint64(0, 0);
		this.sys = sys_ !== undefined ? sys_ : new Go$Uint64(0, 0);
		this.nlookup = nlookup_ !== undefined ? nlookup_ : new Go$Uint64(0, 0);
		this.nmalloc = nmalloc_ !== undefined ? nmalloc_ : new Go$Uint64(0, 0);
		this.nfree = nfree_ !== undefined ? nfree_ : new Go$Uint64(0, 0);
		this.heap_alloc = heap_alloc_ !== undefined ? heap_alloc_ : new Go$Uint64(0, 0);
		this.heap_sys = heap_sys_ !== undefined ? heap_sys_ : new Go$Uint64(0, 0);
		this.heap_idle = heap_idle_ !== undefined ? heap_idle_ : new Go$Uint64(0, 0);
		this.heap_inuse = heap_inuse_ !== undefined ? heap_inuse_ : new Go$Uint64(0, 0);
		this.heap_released = heap_released_ !== undefined ? heap_released_ : new Go$Uint64(0, 0);
		this.heap_objects = heap_objects_ !== undefined ? heap_objects_ : new Go$Uint64(0, 0);
		this.stacks_inuse = stacks_inuse_ !== undefined ? stacks_inuse_ : new Go$Uint64(0, 0);
		this.stacks_sys = stacks_sys_ !== undefined ? stacks_sys_ : new Go$Uint64(0, 0);
		this.mspan_inuse = mspan_inuse_ !== undefined ? mspan_inuse_ : new Go$Uint64(0, 0);
		this.mspan_sys = mspan_sys_ !== undefined ? mspan_sys_ : new Go$Uint64(0, 0);
		this.mcache_inuse = mcache_inuse_ !== undefined ? mcache_inuse_ : new Go$Uint64(0, 0);
		this.mcache_sys = mcache_sys_ !== undefined ? mcache_sys_ : new Go$Uint64(0, 0);
		this.buckhash_sys = buckhash_sys_ !== undefined ? buckhash_sys_ : new Go$Uint64(0, 0);
		this.gc_sys = gc_sys_ !== undefined ? gc_sys_ : new Go$Uint64(0, 0);
		this.other_sys = other_sys_ !== undefined ? other_sys_ : new Go$Uint64(0, 0);
		this.next_gc = next_gc_ !== undefined ? next_gc_ : new Go$Uint64(0, 0);
		this.last_gc = last_gc_ !== undefined ? last_gc_ : new Go$Uint64(0, 0);
		this.pause_total_ns = pause_total_ns_ !== undefined ? pause_total_ns_ : new Go$Uint64(0, 0);
		this.pause_ns = pause_ns_ !== undefined ? pause_ns_ : go$makeNativeArray("Uint64", 256, function() { return new Go$Uint64(0, 0); });
		this.numgc = numgc_ !== undefined ? numgc_ : 0;
		this.enablegc = enablegc_ !== undefined ? enablegc_ : 0;
		this.debuggc = debuggc_ !== undefined ? debuggc_ : 0;
		this.by_size = by_size_ !== undefined ? by_size_ : go$makeNativeArray("Struct", 61, function() { return new _1_.Ptr(); });
	});
	go$pkg.mstats = mstats;
	var mcachelist;
	mcachelist = go$newType(0, "Struct", "runtime.mcachelist", "mcachelist", "runtime", function(list_, nlist_) {
		this.go$val = this;
		this.list = list_ !== undefined ? list_ : (go$ptrType(mlink)).nil;
		this.nlist = nlist_ !== undefined ? nlist_ : 0;
	});
	go$pkg.mcachelist = mcachelist;
	var mcache;
	mcache = go$newType(0, "Struct", "runtime.mcache", "mcache", "runtime", function(next_sample_, local_cachealloc_, list_, local_nlookup_, local_largefree_, local_nlargefree_, local_nsmallfree_) {
		this.go$val = this;
		this.next_sample = next_sample_ !== undefined ? next_sample_ : 0;
		this.local_cachealloc = local_cachealloc_ !== undefined ? local_cachealloc_ : new Go$Int64(0, 0);
		this.list = list_ !== undefined ? list_ : go$makeNativeArray("Struct", 61, function() { return new mcachelist.Ptr(); });
		this.local_nlookup = local_nlookup_ !== undefined ? local_nlookup_ : new Go$Uint64(0, 0);
		this.local_largefree = local_largefree_ !== undefined ? local_largefree_ : new Go$Uint64(0, 0);
		this.local_nlargefree = local_nlargefree_ !== undefined ? local_nlargefree_ : new Go$Uint64(0, 0);
		this.local_nsmallfree = local_nsmallfree_ !== undefined ? local_nsmallfree_ : go$makeNativeArray("Uint64", 61, function() { return new Go$Uint64(0, 0); });
	});
	go$pkg.mcache = mcache;
	var mtypes;
	mtypes = go$newType(0, "Struct", "runtime.mtypes", "mtypes", "runtime", function(compression_, data_) {
		this.go$val = this;
		this.compression = compression_ !== undefined ? compression_ : 0;
		this.data = data_ !== undefined ? data_ : new Go$Uint64(0, 0);
	});
	go$pkg.mtypes = mtypes;
	var mspan;
	mspan = go$newType(0, "Struct", "runtime.mspan", "mspan", "runtime", function(next_, prev_, start_, npages_, freelist_, ref_, sizeclass_, elemsize_, state_, unusedsince_, npreleased_, limit_, types_) {
		this.go$val = this;
		this.next = next_ !== undefined ? next_ : (go$ptrType(mspan)).nil;
		this.prev = prev_ !== undefined ? prev_ : (go$ptrType(mspan)).nil;
		this.start = start_ !== undefined ? start_ : new Go$Uint64(0, 0);
		this.npages = npages_ !== undefined ? npages_ : new Go$Uint64(0, 0);
		this.freelist = freelist_ !== undefined ? freelist_ : (go$ptrType(mlink)).nil;
		this.ref = ref_ !== undefined ? ref_ : 0;
		this.sizeclass = sizeclass_ !== undefined ? sizeclass_ : 0;
		this.elemsize = elemsize_ !== undefined ? elemsize_ : new Go$Uint64(0, 0);
		this.state = state_ !== undefined ? state_ : 0;
		this.unusedsince = unusedsince_ !== undefined ? unusedsince_ : new Go$Int64(0, 0);
		this.npreleased = npreleased_ !== undefined ? npreleased_ : new Go$Uint64(0, 0);
		this.limit = limit_ !== undefined ? limit_ : (go$ptrType(Go$Uint8)).nil;
		this.types = types_ !== undefined ? types_ : new mtypes.Ptr();
	});
	go$pkg.mspan = mspan;
	var mcentral;
	mcentral = go$newType(0, "Struct", "runtime.mcentral", "mcentral", "runtime", function(lock_, sizeclass_, nonempty_, empty_, nfree_) {
		this.go$val = this;
		this.lock = lock_ !== undefined ? lock_ : new lock.Ptr();
		this.sizeclass = sizeclass_ !== undefined ? sizeclass_ : 0;
		this.nonempty = nonempty_ !== undefined ? nonempty_ : new mspan.Ptr();
		this.empty = empty_ !== undefined ? empty_ : new mspan.Ptr();
		this.nfree = nfree_ !== undefined ? nfree_ : 0;
	});
	go$pkg.mcentral = mcentral;
	var _2_;
	_2_ = go$newType(0, "Struct", "runtime._2_", "_2_", "runtime", function(mcentral_, pad_) {
		this.go$val = this;
		this.mcentral = mcentral_ !== undefined ? mcentral_ : new mcentral.Ptr();
		this.pad = pad_ !== undefined ? pad_ : go$makeNativeArray("Uint8", 64, function() { return 0; });
	});
	go$pkg._2_ = _2_;
	var mheap;
	mheap = go$newType(0, "Struct", "runtime.mheap", "mheap", "runtime", function(lock_, free_, large_, allspans_, nspan_, nspancap_, spans_, spans_mapped_, bitmap_, bitmap_mapped_, arena_start_, arena_used_, arena_end_, central_, spanalloc_, cachealloc_, largefree_, nlargefree_, nsmallfree_) {
		this.go$val = this;
		this.lock = lock_ !== undefined ? lock_ : new lock.Ptr();
		this.free = free_ !== undefined ? free_ : go$makeNativeArray("Struct", 256, function() { return new mspan.Ptr(); });
		this.large = large_ !== undefined ? large_ : new mspan.Ptr();
		this.allspans = allspans_ !== undefined ? allspans_ : (go$ptrType((go$ptrType(mspan)))).nil;
		this.nspan = nspan_ !== undefined ? nspan_ : 0;
		this.nspancap = nspancap_ !== undefined ? nspancap_ : 0;
		this.spans = spans_ !== undefined ? spans_ : (go$ptrType((go$ptrType(mspan)))).nil;
		this.spans_mapped = spans_mapped_ !== undefined ? spans_mapped_ : new Go$Uint64(0, 0);
		this.bitmap = bitmap_ !== undefined ? bitmap_ : (go$ptrType(Go$Uint8)).nil;
		this.bitmap_mapped = bitmap_mapped_ !== undefined ? bitmap_mapped_ : new Go$Uint64(0, 0);
		this.arena_start = arena_start_ !== undefined ? arena_start_ : (go$ptrType(Go$Uint8)).nil;
		this.arena_used = arena_used_ !== undefined ? arena_used_ : (go$ptrType(Go$Uint8)).nil;
		this.arena_end = arena_end_ !== undefined ? arena_end_ : (go$ptrType(Go$Uint8)).nil;
		this.central = central_ !== undefined ? central_ : go$makeNativeArray("Struct", 61, function() { return new _2_.Ptr(); });
		this.spanalloc = spanalloc_ !== undefined ? spanalloc_ : new fixalloc.Ptr();
		this.cachealloc = cachealloc_ !== undefined ? cachealloc_ : new fixalloc.Ptr();
		this.largefree = largefree_ !== undefined ? largefree_ : new Go$Uint64(0, 0);
		this.nlargefree = nlargefree_ !== undefined ? nlargefree_ : new Go$Uint64(0, 0);
		this.nsmallfree = nsmallfree_ !== undefined ? nsmallfree_ : go$makeNativeArray("Uint64", 61, function() { return new Go$Uint64(0, 0); });
	});
	go$pkg.mheap = mheap;
	var _type;
	_type = go$newType(0, "Struct", "runtime._type", "_type", "runtime", function(size_, hash_, _unused_, align_, fieldalign_, kind_, alg_, gc_, _string_, x_, ptrto_) {
		this.go$val = this;
		this.size = size_ !== undefined ? size_ : new Go$Uint64(0, 0);
		this.hash = hash_ !== undefined ? hash_ : 0;
		this._unused = _unused_ !== undefined ? _unused_ : 0;
		this.align = align_ !== undefined ? align_ : 0;
		this.fieldalign = fieldalign_ !== undefined ? fieldalign_ : 0;
		this.kind = kind_ !== undefined ? kind_ : 0;
		this.alg = alg_ !== undefined ? alg_ : (go$ptrType(alg)).nil;
		this.gc = gc_ !== undefined ? gc_ : 0;
		this._string = _string_ !== undefined ? _string_ : (go$ptrType(Go$String)).nil;
		this.x = x_ !== undefined ? x_ : (go$ptrType(uncommontype)).nil;
		this.ptrto = ptrto_ !== undefined ? ptrto_ : (go$ptrType(_type)).nil;
	});
	go$pkg._type = _type;
	var method;
	method = go$newType(0, "Struct", "runtime.method", "method", "runtime", function(name_, pkgpath_, mtyp_, typ_, ifn_, tfn_) {
		this.go$val = this;
		this.name = name_ !== undefined ? name_ : (go$ptrType(Go$String)).nil;
		this.pkgpath = pkgpath_ !== undefined ? pkgpath_ : (go$ptrType(Go$String)).nil;
		this.mtyp = mtyp_ !== undefined ? mtyp_ : (go$ptrType(_type)).nil;
		this.typ = typ_ !== undefined ? typ_ : (go$ptrType(_type)).nil;
		this.ifn = ifn_ !== undefined ? ifn_ : go$throwNilPointerError;
		this.tfn = tfn_ !== undefined ? tfn_ : go$throwNilPointerError;
	});
	go$pkg.method = method;
	var uncommontype;
	uncommontype = go$newType(0, "Struct", "runtime.uncommontype", "uncommontype", "runtime", function(name_, pkgpath_, mhdr_, m_) {
		this.go$val = this;
		this.name = name_ !== undefined ? name_ : (go$ptrType(Go$String)).nil;
		this.pkgpath = pkgpath_ !== undefined ? pkgpath_ : (go$ptrType(Go$String)).nil;
		this.mhdr = mhdr_ !== undefined ? mhdr_ : (go$sliceType(Go$Uint8)).nil;
		this.m = m_ !== undefined ? m_ : go$makeNativeArray("Struct", 0, function() { return new method.Ptr(); });
	});
	go$pkg.uncommontype = uncommontype;
	var imethod;
	imethod = go$newType(0, "Struct", "runtime.imethod", "imethod", "runtime", function(name_, pkgpath_, _type_) {
		this.go$val = this;
		this.name = name_ !== undefined ? name_ : (go$ptrType(Go$String)).nil;
		this.pkgpath = pkgpath_ !== undefined ? pkgpath_ : (go$ptrType(Go$String)).nil;
		this._type = _type_ !== undefined ? _type_ : (go$ptrType(_type)).nil;
	});
	go$pkg.imethod = imethod;
	var interfacetype;
	interfacetype = go$newType(0, "Struct", "runtime.interfacetype", "interfacetype", "runtime", function(_type_, mhdr_, m_) {
		this.go$val = this;
		this._type = _type_ !== undefined ? _type_ : new _type.Ptr();
		this.mhdr = mhdr_ !== undefined ? mhdr_ : (go$sliceType(Go$Uint8)).nil;
		this.m = m_ !== undefined ? m_ : go$makeNativeArray("Struct", 0, function() { return new imethod.Ptr(); });
	});
	go$pkg.interfacetype = interfacetype;
	var maptype;
	maptype = go$newType(0, "Struct", "runtime.maptype", "maptype", "runtime", function(_type_, key_, elem_, bucket_, hmap_) {
		this.go$val = this;
		this._type = _type_ !== undefined ? _type_ : new _type.Ptr();
		this.key = key_ !== undefined ? key_ : (go$ptrType(_type)).nil;
		this.elem = elem_ !== undefined ? elem_ : (go$ptrType(_type)).nil;
		this.bucket = bucket_ !== undefined ? bucket_ : (go$ptrType(_type)).nil;
		this.hmap = hmap_ !== undefined ? hmap_ : (go$ptrType(_type)).nil;
	});
	go$pkg.maptype = maptype;
	var chantype;
	chantype = go$newType(0, "Struct", "runtime.chantype", "chantype", "runtime", function(_type_, elem_, dir_) {
		this.go$val = this;
		this._type = _type_ !== undefined ? _type_ : new _type.Ptr();
		this.elem = elem_ !== undefined ? elem_ : (go$ptrType(_type)).nil;
		this.dir = dir_ !== undefined ? dir_ : new Go$Uint64(0, 0);
	});
	go$pkg.chantype = chantype;
	var slicetype;
	slicetype = go$newType(0, "Struct", "runtime.slicetype", "slicetype", "runtime", function(_type_, elem_) {
		this.go$val = this;
		this._type = _type_ !== undefined ? _type_ : new _type.Ptr();
		this.elem = elem_ !== undefined ? elem_ : (go$ptrType(_type)).nil;
	});
	go$pkg.slicetype = slicetype;
	var functype;
	functype = go$newType(0, "Struct", "runtime.functype", "functype", "runtime", function(_type_, dotdotdot_, in$2_, out_) {
		this.go$val = this;
		this._type = _type_ !== undefined ? _type_ : new _type.Ptr();
		this.dotdotdot = dotdotdot_ !== undefined ? dotdotdot_ : 0;
		this.in$2 = in$2_ !== undefined ? in$2_ : (go$sliceType(Go$Uint8)).nil;
		this.out = out_ !== undefined ? out_ : (go$sliceType(Go$Uint8)).nil;
	});
	go$pkg.functype = functype;
	var ptrtype;
	ptrtype = go$newType(0, "Struct", "runtime.ptrtype", "ptrtype", "runtime", function(_type_, elem_) {
		this.go$val = this;
		this._type = _type_ !== undefined ? _type_ : new _type.Ptr();
		this.elem = elem_ !== undefined ? elem_ : (go$ptrType(_type)).nil;
	});
	go$pkg.ptrtype = ptrtype;
	var sched;
	sched = go$newType(0, "Struct", "runtime.sched", "sched", "runtime", function(lock_, goidgen_, midle_, nmidle_, nmidlelocked_, mcount_, maxmcount_, pidle_, npidle_, nmspinning_, runqhead_, runqtail_, runqsize_, gflock_, gfree_, gcwaiting_, stopwait_, stopnote_, sysmonwait_, sysmonnote_, lastpoll_, profilehz_) {
		this.go$val = this;
		this.lock = lock_ !== undefined ? lock_ : new lock.Ptr();
		this.goidgen = goidgen_ !== undefined ? goidgen_ : new Go$Uint64(0, 0);
		this.midle = midle_ !== undefined ? midle_ : (go$ptrType(m)).nil;
		this.nmidle = nmidle_ !== undefined ? nmidle_ : 0;
		this.nmidlelocked = nmidlelocked_ !== undefined ? nmidlelocked_ : 0;
		this.mcount = mcount_ !== undefined ? mcount_ : 0;
		this.maxmcount = maxmcount_ !== undefined ? maxmcount_ : 0;
		this.pidle = pidle_ !== undefined ? pidle_ : (go$ptrType(p)).nil;
		this.npidle = npidle_ !== undefined ? npidle_ : 0;
		this.nmspinning = nmspinning_ !== undefined ? nmspinning_ : 0;
		this.runqhead = runqhead_ !== undefined ? runqhead_ : (go$ptrType(g)).nil;
		this.runqtail = runqtail_ !== undefined ? runqtail_ : (go$ptrType(g)).nil;
		this.runqsize = runqsize_ !== undefined ? runqsize_ : 0;
		this.gflock = gflock_ !== undefined ? gflock_ : new lock.Ptr();
		this.gfree = gfree_ !== undefined ? gfree_ : (go$ptrType(g)).nil;
		this.gcwaiting = gcwaiting_ !== undefined ? gcwaiting_ : 0;
		this.stopwait = stopwait_ !== undefined ? stopwait_ : 0;
		this.stopnote = stopnote_ !== undefined ? stopnote_ : new note.Ptr();
		this.sysmonwait = sysmonwait_ !== undefined ? sysmonwait_ : 0;
		this.sysmonnote = sysmonnote_ !== undefined ? sysmonnote_ : new note.Ptr();
		this.lastpoll = lastpoll_ !== undefined ? lastpoll_ : new Go$Uint64(0, 0);
		this.profilehz = profilehz_ !== undefined ? profilehz_ : 0;
	});
	go$pkg.sched = sched;
	var cgothreadstart;
	cgothreadstart = go$newType(0, "Struct", "runtime.cgothreadstart", "cgothreadstart", "runtime", function(m_, g_, fn_) {
		this.go$val = this;
		this.m = m_ !== undefined ? m_ : (go$ptrType(m)).nil;
		this.g = g_ !== undefined ? g_ : (go$ptrType(g)).nil;
		this.fn = fn_ !== undefined ? fn_ : go$throwNilPointerError;
	});
	go$pkg.cgothreadstart = cgothreadstart;
	var _3_;
	_3_ = go$newType(0, "Struct", "runtime._3_", "_3_", "runtime", function(lock_, fn_, hz_, pcbuf_) {
		this.go$val = this;
		this.lock = lock_ !== undefined ? lock_ : new lock.Ptr();
		this.fn = fn_ !== undefined ? fn_ : go$throwNilPointerError;
		this.hz = hz_ !== undefined ? hz_ : 0;
		this.pcbuf = pcbuf_ !== undefined ? pcbuf_ : go$makeNativeArray("Uint64", 100, function() { return new Go$Uint64(0, 0); });
	});
	go$pkg._3_ = _3_;
	var pdesc;
	pdesc = go$newType(0, "Struct", "runtime.pdesc", "pdesc", "runtime", function(schedtick_, schedwhen_, syscalltick_, syscallwhen_) {
		this.go$val = this;
		this.schedtick = schedtick_ !== undefined ? schedtick_ : 0;
		this.schedwhen = schedwhen_ !== undefined ? schedwhen_ : new Go$Int64(0, 0);
		this.syscalltick = syscalltick_ !== undefined ? syscalltick_ : 0;
		this.syscallwhen = syscallwhen_ !== undefined ? syscallwhen_ : new Go$Int64(0, 0);
	});
	go$pkg.pdesc = pdesc;
	var bucket;
	bucket = go$newType(0, "Struct", "runtime.bucket", "bucket", "runtime", function(tophash_, overflow_, data_) {
		this.go$val = this;
		this.tophash = tophash_ !== undefined ? tophash_ : go$makeNativeArray("Uint8", 8, function() { return 0; });
		this.overflow = overflow_ !== undefined ? overflow_ : (go$ptrType(bucket)).nil;
		this.data = data_ !== undefined ? data_ : go$makeNativeArray("Uint8", 1, function() { return 0; });
	});
	go$pkg.bucket = bucket;
	var hmap;
	hmap = go$newType(0, "Struct", "runtime.hmap", "hmap", "runtime", function(count_, flags_, hash0_, b_, keysize_, valuesize_, bucketsize_, buckets_, oldbuckets_, nevacuate_) {
		this.go$val = this;
		this.count = count_ !== undefined ? count_ : new Go$Uint64(0, 0);
		this.flags = flags_ !== undefined ? flags_ : 0;
		this.hash0 = hash0_ !== undefined ? hash0_ : 0;
		this.b = b_ !== undefined ? b_ : 0;
		this.keysize = keysize_ !== undefined ? keysize_ : 0;
		this.valuesize = valuesize_ !== undefined ? valuesize_ : 0;
		this.bucketsize = bucketsize_ !== undefined ? bucketsize_ : 0;
		this.buckets = buckets_ !== undefined ? buckets_ : (go$ptrType(Go$Uint8)).nil;
		this.oldbuckets = oldbuckets_ !== undefined ? oldbuckets_ : (go$ptrType(Go$Uint8)).nil;
		this.nevacuate = nevacuate_ !== undefined ? nevacuate_ : new Go$Uint64(0, 0);
	});
	go$pkg.hmap = hmap;
	var hash_iter;
	hash_iter = go$newType(0, "Struct", "runtime.hash_iter", "hash_iter", "runtime", function(key_, value_, t_, h_, endbucket_, wrapped_, b_, buckets_, bucket_, bptr_, i_, check_bucket_) {
		this.go$val = this;
		this.key = key_ !== undefined ? key_ : (go$ptrType(Go$Uint8)).nil;
		this.value = value_ !== undefined ? value_ : (go$ptrType(Go$Uint8)).nil;
		this.t = t_ !== undefined ? t_ : (go$ptrType(maptype)).nil;
		this.h = h_ !== undefined ? h_ : (go$ptrType(hmap)).nil;
		this.endbucket = endbucket_ !== undefined ? endbucket_ : new Go$Uint64(0, 0);
		this.wrapped = wrapped_ !== undefined ? wrapped_ : 0;
		this.b = b_ !== undefined ? b_ : 0;
		this.buckets = buckets_ !== undefined ? buckets_ : (go$ptrType(Go$Uint8)).nil;
		this.bucket = bucket_ !== undefined ? bucket_ : new Go$Uint64(0, 0);
		this.bptr = bptr_ !== undefined ? bptr_ : (go$ptrType(bucket)).nil;
		this.i = i_ !== undefined ? i_ : new Go$Uint64(0, 0);
		this.check_bucket = check_bucket_ !== undefined ? check_bucket_ : new Go$Int64(0, 0);
	});
	go$pkg.hash_iter = hash_iter;
	var sudog;
	sudog = go$newType(0, "Struct", "runtime.sudog", "sudog", "runtime", function(g_, selgen_, link_, releasetime_, elem_) {
		this.go$val = this;
		this.g = g_ !== undefined ? g_ : (go$ptrType(g)).nil;
		this.selgen = selgen_ !== undefined ? selgen_ : 0;
		this.link = link_ !== undefined ? link_ : (go$ptrType(sudog)).nil;
		this.releasetime = releasetime_ !== undefined ? releasetime_ : new Go$Int64(0, 0);
		this.elem = elem_ !== undefined ? elem_ : (go$ptrType(Go$Uint8)).nil;
	});
	go$pkg.sudog = sudog;
	var waitq;
	waitq = go$newType(0, "Struct", "runtime.waitq", "waitq", "runtime", function(first_, last_) {
		this.go$val = this;
		this.first = first_ !== undefined ? first_ : (go$ptrType(sudog)).nil;
		this.last = last_ !== undefined ? last_ : (go$ptrType(sudog)).nil;
	});
	go$pkg.waitq = waitq;
	var hchan;
	hchan = go$newType(0, "Struct", "runtime.hchan", "hchan", "runtime", function(qcount_, dataqsiz_, elemsize_, pad_, closed_, elemalg_, sendx_, recvx_, recvq_, sendq_, lock_) {
		this.go$val = this;
		this.qcount = qcount_ !== undefined ? qcount_ : new Go$Uint64(0, 0);
		this.dataqsiz = dataqsiz_ !== undefined ? dataqsiz_ : new Go$Uint64(0, 0);
		this.elemsize = elemsize_ !== undefined ? elemsize_ : 0;
		this.pad = pad_ !== undefined ? pad_ : 0;
		this.closed = closed_ !== undefined ? closed_ : 0;
		this.elemalg = elemalg_ !== undefined ? elemalg_ : (go$ptrType(alg)).nil;
		this.sendx = sendx_ !== undefined ? sendx_ : new Go$Uint64(0, 0);
		this.recvx = recvx_ !== undefined ? recvx_ : new Go$Uint64(0, 0);
		this.recvq = recvq_ !== undefined ? recvq_ : new waitq.Ptr();
		this.sendq = sendq_ !== undefined ? sendq_ : new waitq.Ptr();
		this.lock = lock_ !== undefined ? lock_ : new lock.Ptr();
	});
	go$pkg.hchan = hchan;
	var scase;
	scase = go$newType(0, "Struct", "runtime.scase", "scase", "runtime", function(sg_, _chan_, pc_, kind_, so_, receivedp_) {
		this.go$val = this;
		this.sg = sg_ !== undefined ? sg_ : new sudog.Ptr();
		this._chan = _chan_ !== undefined ? _chan_ : (go$ptrType(hchan)).nil;
		this.pc = pc_ !== undefined ? pc_ : (go$ptrType(Go$Uint8)).nil;
		this.kind = kind_ !== undefined ? kind_ : 0;
		this.so = so_ !== undefined ? so_ : 0;
		this.receivedp = receivedp_ !== undefined ? receivedp_ : (go$ptrType(Go$Uint8)).nil;
	});
	go$pkg.scase = scase;
	var _select;
	_select = go$newType(0, "Struct", "runtime._select", "_select", "runtime", function(tcase_, ncase_, pollorder_, lockorder_, scase_) {
		this.go$val = this;
		this.tcase = tcase_ !== undefined ? tcase_ : 0;
		this.ncase = ncase_ !== undefined ? ncase_ : 0;
		this.pollorder = pollorder_ !== undefined ? pollorder_ : (go$ptrType(Go$Uint16)).nil;
		this.lockorder = lockorder_ !== undefined ? lockorder_ : (go$ptrType((go$ptrType(hchan)))).nil;
		this.scase = scase_ !== undefined ? scase_ : go$makeNativeArray("Struct", 1, function() { return new scase.Ptr(); });
	});
	go$pkg._select = _select;
	var runtimeselect;
	runtimeselect = go$newType(0, "Struct", "runtime.runtimeselect", "runtimeselect", "runtime", function(dir_, typ_, ch_, val_) {
		this.go$val = this;
		this.dir = dir_ !== undefined ? dir_ : new Go$Uint64(0, 0);
		this.typ = typ_ !== undefined ? typ_ : (go$ptrType(chantype)).nil;
		this.ch = ch_ !== undefined ? ch_ : (go$ptrType(hchan)).nil;
		this.val = val_ !== undefined ? val_ : new Go$Uint64(0, 0);
	});
	go$pkg.runtimeselect = runtimeselect;
	var parforthread;
	parforthread = go$newType(0, "Struct", "runtime.parforthread", "parforthread", "runtime", function(pos_, nsteal_, nstealcnt_, nprocyield_, nosyield_, nsleep_, pad_) {
		this.go$val = this;
		this.pos = pos_ !== undefined ? pos_ : new Go$Uint64(0, 0);
		this.nsteal = nsteal_ !== undefined ? nsteal_ : new Go$Uint64(0, 0);
		this.nstealcnt = nstealcnt_ !== undefined ? nstealcnt_ : new Go$Uint64(0, 0);
		this.nprocyield = nprocyield_ !== undefined ? nprocyield_ : new Go$Uint64(0, 0);
		this.nosyield = nosyield_ !== undefined ? nosyield_ : new Go$Uint64(0, 0);
		this.nsleep = nsleep_ !== undefined ? nsleep_ : new Go$Uint64(0, 0);
		this.pad = pad_ !== undefined ? pad_ : go$makeNativeArray("Uint8", 64, function() { return 0; });
	});
	go$pkg.parforthread = parforthread;
	MemProfileRecord.init([["AllocBytes", "", Go$Int64, ""], ["FreeBytes", "", Go$Int64, ""], ["AllocObjects", "", Go$Int64, ""], ["FreeObjects", "", Go$Int64, ""], ["Stack0", "", (go$arrayType(Go$Uintptr, 32)), ""]]);
	(go$ptrType(MemProfileRecord)).methods = [["InUseBytes", "", [], [Go$Int64], false], ["InUseObjects", "", [], [Go$Int64], false], ["Stack", "", [], [(go$sliceType(Go$Uintptr))], false]];
	StackRecord.init([["Stack0", "", (go$arrayType(Go$Uintptr, 32)), ""]]);
	(go$ptrType(StackRecord)).methods = [["Stack", "", [], [(go$sliceType(Go$Uintptr))], false]];
	BlockProfileRecord.init([["Count", "", Go$Int64, ""], ["Cycles", "", Go$Int64, ""], ["", "", StackRecord, ""]]);
	(go$ptrType(BlockProfileRecord)).methods = [["Stack", "", [], [(go$sliceType(Go$Uintptr))], false]];
	Error.init([["Error", "", (go$funcType([], [Go$String], false))], ["RuntimeError", "", (go$funcType([], [], false))]]);
	TypeAssertionError.init([["interfaceString", "runtime", Go$String, ""], ["concreteString", "runtime", Go$String, ""], ["assertedString", "runtime", Go$String, ""], ["missingMethod", "runtime", Go$String, ""]]);
	(go$ptrType(TypeAssertionError)).methods = [["Error", "", [], [Go$String], false], ["RuntimeError", "", [], [], false]];
	errorString.methods = [["Error", "", [], [Go$String], false], ["RuntimeError", "", [], [], false]];
	(go$ptrType(errorString)).methods = [["Error", "", [], [Go$String], false], ["RuntimeError", "", [], [], false]];
	errorCString.methods = [["Error", "", [], [Go$String], false], ["RuntimeError", "", [], [], false]];
	(go$ptrType(errorCString)).methods = [["Error", "", [], [Go$String], false], ["RuntimeError", "", [], [], false]];
	stringer.init([["String", "", (go$funcType([], [Go$String], false))]]);
	Func.init([["opaque", "runtime", (go$structType([])), ""]]);
	(go$ptrType(Func)).methods = [["Entry", "", [], [Go$Uintptr], false], ["FileLine", "", [Go$Uintptr], [Go$String, Go$Int], false], ["Name", "", [], [Go$String], false]];
	MemStats.init([["Alloc", "", Go$Uint64, ""], ["TotalAlloc", "", Go$Uint64, ""], ["Sys", "", Go$Uint64, ""], ["Lookups", "", Go$Uint64, ""], ["Mallocs", "", Go$Uint64, ""], ["Frees", "", Go$Uint64, ""], ["HeapAlloc", "", Go$Uint64, ""], ["HeapSys", "", Go$Uint64, ""], ["HeapIdle", "", Go$Uint64, ""], ["HeapInuse", "", Go$Uint64, ""], ["HeapReleased", "", Go$Uint64, ""], ["HeapObjects", "", Go$Uint64, ""], ["StackInuse", "", Go$Uint64, ""], ["StackSys", "", Go$Uint64, ""], ["MSpanInuse", "", Go$Uint64, ""], ["MSpanSys", "", Go$Uint64, ""], ["MCacheInuse", "", Go$Uint64, ""], ["MCacheSys", "", Go$Uint64, ""], ["BuckHashSys", "", Go$Uint64, ""], ["GCSys", "", Go$Uint64, ""], ["OtherSys", "", Go$Uint64, ""], ["NextGC", "", Go$Uint64, ""], ["LastGC", "", Go$Uint64, ""], ["PauseTotalNs", "", Go$Uint64, ""], ["PauseNs", "", (go$arrayType(Go$Uint64, 256)), ""], ["NumGC", "", Go$Uint32, ""], ["EnableGC", "", Go$Bool, ""], ["DebugGC", "", Go$Bool, ""], ["BySize", "", (go$arrayType((go$structType([["Size", "", Go$Uint32, ""], ["Mallocs", "", Go$Uint64, ""], ["Frees", "", Go$Uint64, ""]])), 61)), ""]]);
	rtype.init([["size", "runtime", Go$Uintptr, ""], ["hash", "runtime", Go$Uint32, ""], ["_", "runtime", Go$Uint8, ""], ["align", "runtime", Go$Uint8, ""], ["fieldAlign", "runtime", Go$Uint8, ""], ["kind", "runtime", Go$Uint8, ""], ["alg", "runtime", Go$UnsafePointer, ""], ["gc", "runtime", Go$UnsafePointer, ""], ["string", "runtime", (go$ptrType(Go$String)), ""], ["", "runtime", (go$ptrType(uncommonType)), ""], ["ptrToThis", "runtime", (go$ptrType(rtype)), ""]]);
	_method.init([["name", "runtime", (go$ptrType(Go$String)), ""], ["pkgPath", "runtime", (go$ptrType(Go$String)), ""], ["mtyp", "runtime", (go$ptrType(rtype)), ""], ["typ", "runtime", (go$ptrType(rtype)), ""], ["ifn", "runtime", Go$UnsafePointer, ""], ["tfn", "runtime", Go$UnsafePointer, ""]]);
	uncommonType.init([["name", "runtime", (go$ptrType(Go$String)), ""], ["pkgPath", "runtime", (go$ptrType(Go$String)), ""], ["methods", "runtime", (go$sliceType(_method)), ""]]);
	_imethod.init([["name", "runtime", (go$ptrType(Go$String)), ""], ["pkgPath", "runtime", (go$ptrType(Go$String)), ""], ["typ", "runtime", (go$ptrType(rtype)), ""]]);
	interfaceType.init([["", "runtime", rtype, ""], ["methods", "runtime", (go$sliceType(_imethod)), ""]]);
	lock.init([["key", "runtime", Go$Uint64, ""]]);
	note.init([["key", "runtime", Go$Uint64, ""]]);
	_string.init([["str", "runtime", (go$ptrType(Go$Uint8)), ""], ["len", "runtime", Go$Int64, ""]]);
	funcval.init([["fn", "runtime", (go$funcType([], [], false)), ""]]);
	iface.init([["tab", "runtime", (go$ptrType(itab)), ""], ["data", "runtime", Go$UnsafePointer, ""]]);
	eface.init([["_type", "runtime", (go$ptrType(_type)), ""], ["data", "runtime", Go$UnsafePointer, ""]]);
	_complex64.init([["real", "runtime", Go$Float32, ""], ["imag", "runtime", Go$Float32, ""]]);
	_complex128.init([["real", "runtime", Go$Float64, ""], ["imag", "runtime", Go$Float64, ""]]);
	slice.init([["array", "runtime", (go$ptrType(Go$Uint8)), ""], ["len", "runtime", Go$Uint64, ""], ["cap", "runtime", Go$Uint64, ""]]);
	gobuf.init([["sp", "runtime", Go$Uint64, ""], ["pc", "runtime", Go$Uint64, ""], ["g", "runtime", (go$ptrType(g)), ""], ["ret", "runtime", Go$Uint64, ""], ["ctxt", "runtime", Go$UnsafePointer, ""], ["lr", "runtime", Go$Uint64, ""]]);
	gcstats.init([["nhandoff", "runtime", Go$Uint64, ""], ["nhandoffcnt", "runtime", Go$Uint64, ""], ["nprocyield", "runtime", Go$Uint64, ""], ["nosyield", "runtime", Go$Uint64, ""], ["nsleep", "runtime", Go$Uint64, ""]]);
	wincall.init([["fn", "runtime", (go$funcType([Go$UnsafePointer], [], false)), ""], ["n", "runtime", Go$Uint64, ""], ["args", "runtime", Go$UnsafePointer, ""], ["r1", "runtime", Go$Uint64, ""], ["r2", "runtime", Go$Uint64, ""], ["err", "runtime", Go$Uint64, ""]]);
	seh.init([["prev", "runtime", Go$UnsafePointer, ""], ["handler", "runtime", Go$UnsafePointer, ""]]);
	wincallbackcontext.init([["gobody", "runtime", Go$UnsafePointer, ""], ["argsize", "runtime", Go$Uint64, ""], ["restorestack", "runtime", Go$Uint64, ""]]);
	g.init([["stackguard0", "runtime", Go$Uint64, ""], ["stackbase", "runtime", Go$Uint64, ""], ["panicwrap", "runtime", Go$Uint32, ""], ["selgen", "runtime", Go$Uint32, ""], ["_defer", "runtime", (go$ptrType(_defer)), ""], ["_panic", "runtime", (go$ptrType(_panic)), ""], ["sched", "runtime", gobuf, ""], ["syscallstack", "runtime", Go$Uint64, ""], ["syscallsp", "runtime", Go$Uint64, ""], ["syscallpc", "runtime", Go$Uint64, ""], ["syscallguard", "runtime", Go$Uint64, ""], ["stackguard", "runtime", Go$Uint64, ""], ["stack0", "runtime", Go$Uint64, ""], ["stacksize", "runtime", Go$Uint64, ""], ["alllink", "runtime", (go$ptrType(g)), ""], ["param", "runtime", Go$UnsafePointer, ""], ["status", "runtime", Go$Int16, ""], ["goid", "runtime", Go$Int64, ""], ["waitreason", "runtime", (go$ptrType(Go$Int8)), ""], ["schedlink", "runtime", (go$ptrType(g)), ""], ["ispanic", "runtime", Go$Uint8, ""], ["issystem", "runtime", Go$Uint8, ""], ["isbackground", "runtime", Go$Uint8, ""], ["preempt", "runtime", Go$Uint8, ""], ["raceignore", "runtime", Go$Int8, ""], ["m", "runtime", (go$ptrType(m)), ""], ["lockedm", "runtime", (go$ptrType(m)), ""], ["sig", "runtime", Go$Int32, ""], ["writenbuf", "runtime", Go$Int32, ""], ["writebuf", "runtime", (go$ptrType(Go$Uint8)), ""], ["dchunk", "runtime", (go$ptrType(deferchunk)), ""], ["dchunknext", "runtime", (go$ptrType(deferchunk)), ""], ["sigcode0", "runtime", Go$Uint64, ""], ["sigcode1", "runtime", Go$Uint64, ""], ["sigpc", "runtime", Go$Uint64, ""], ["gopc", "runtime", Go$Uint64, ""], ["racectx", "runtime", Go$Uint64, ""], ["end", "runtime", (go$arrayType(Go$Uint64, 0)), ""]]);
	m.init([["g0", "runtime", (go$ptrType(g)), ""], ["moreargp", "runtime", Go$UnsafePointer, ""], ["morebuf", "runtime", gobuf, ""], ["moreframesize", "runtime", Go$Uint32, ""], ["moreargsize", "runtime", Go$Uint32, ""], ["cret", "runtime", Go$Uint64, ""], ["procid", "runtime", Go$Uint64, ""], ["gsignal", "runtime", (go$ptrType(g)), ""], ["tls", "runtime", (go$arrayType(Go$Uint64, 4)), ""], ["mstartfn", "runtime", (go$funcType([], [], false)), ""], ["curg", "runtime", (go$ptrType(g)), ""], ["caughtsig", "runtime", (go$ptrType(g)), ""], ["p", "runtime", (go$ptrType(p)), ""], ["nextp", "runtime", (go$ptrType(p)), ""], ["id", "runtime", Go$Int32, ""], ["mallocing", "runtime", Go$Int32, ""], ["throwing", "runtime", Go$Int32, ""], ["gcing", "runtime", Go$Int32, ""], ["locks", "runtime", Go$Int32, ""], ["dying", "runtime", Go$Int32, ""], ["profilehz", "runtime", Go$Int32, ""], ["helpgc", "runtime", Go$Int32, ""], ["spinning", "runtime", Go$Uint8, ""], ["fastrand", "runtime", Go$Uint32, ""], ["ncgocall", "runtime", Go$Uint64, ""], ["ncgo", "runtime", Go$Int32, ""], ["cgomal", "runtime", (go$ptrType(cgomal)), ""], ["park", "runtime", note, ""], ["alllink", "runtime", (go$ptrType(m)), ""], ["schedlink", "runtime", (go$ptrType(m)), ""], ["machport", "runtime", Go$Uint32, ""], ["mcache", "runtime", (go$ptrType(mcache)), ""], ["stackinuse", "runtime", Go$Int32, ""], ["stackcachepos", "runtime", Go$Uint32, ""], ["stackcachecnt", "runtime", Go$Uint32, ""], ["stackcache", "runtime", (go$arrayType(Go$UnsafePointer, 32)), ""], ["lockedg", "runtime", (go$ptrType(g)), ""], ["createstack", "runtime", (go$arrayType(Go$Uint64, 32)), ""], ["freglo", "runtime", (go$arrayType(Go$Uint32, 16)), ""], ["freghi", "runtime", (go$arrayType(Go$Uint32, 16)), ""], ["fflag", "runtime", Go$Uint32, ""], ["locked", "runtime", Go$Uint32, ""], ["nextwaitm", "runtime", (go$ptrType(m)), ""], ["waitsema", "runtime", Go$Uint64, ""], ["waitsemacount", "runtime", Go$Uint32, ""], ["waitsemalock", "runtime", Go$Uint32, ""], ["gcstats", "runtime", gcstats, ""], ["racecall", "runtime", Go$Uint8, ""], ["needextram", "runtime", Go$Uint8, ""], ["waitunlockf", "runtime", (go$funcType([(go$ptrType(lock))], [], false)), ""], ["waitlock", "runtime", Go$UnsafePointer, ""], ["settype_buf", "runtime", (go$arrayType(Go$Uint64, 1024)), ""], ["settype_bufsize", "runtime", Go$Uint64, ""], ["thread", "runtime", Go$UnsafePointer, ""], ["wincall", "runtime", wincall, ""], ["seh", "runtime", (go$ptrType(seh)), ""], ["end", "runtime", (go$arrayType(Go$Uint64, 0)), ""]]);
	p.init([["", "runtime", lock, ""], ["id", "runtime", Go$Int32, ""], ["status", "runtime", Go$Uint32, ""], ["link", "runtime", (go$ptrType(p)), ""], ["schedtick", "runtime", Go$Uint32, ""], ["syscalltick", "runtime", Go$Uint32, ""], ["m", "runtime", (go$ptrType(m)), ""], ["mcache", "runtime", (go$ptrType(mcache)), ""], ["runq", "runtime", (go$ptrType((go$ptrType(g)))), ""], ["runqhead", "runtime", Go$Int32, ""], ["runqtail", "runtime", Go$Int32, ""], ["runqsize", "runtime", Go$Int32, ""], ["gfree", "runtime", (go$ptrType(g)), ""], ["gfreecnt", "runtime", Go$Int32, ""], ["pad", "runtime", (go$arrayType(Go$Uint8, 64)), ""]]);
	stktop.init([["stackguard", "runtime", Go$Uint64, ""], ["stackbase", "runtime", Go$Uint64, ""], ["gobuf", "runtime", gobuf, ""], ["argsize", "runtime", Go$Uint32, ""], ["panicwrap", "runtime", Go$Uint32, ""], ["argp", "runtime", (go$ptrType(Go$Uint8)), ""], ["free", "runtime", Go$Uint64, ""], ["_panic", "runtime", Go$Uint8, ""]]);
	sigtab.init([["flags", "runtime", Go$Int32, ""], ["name", "runtime", (go$ptrType(Go$Int8)), ""]]);
	_func.init([["entry", "runtime", Go$Uint64, ""], ["nameoff", "runtime", Go$Int32, ""], ["args", "runtime", Go$Int32, ""], ["frame", "runtime", Go$Int32, ""], ["pcsp", "runtime", Go$Int32, ""], ["pcfile", "runtime", Go$Int32, ""], ["pcln", "runtime", Go$Int32, ""], ["npcdata", "runtime", Go$Int32, ""], ["nfuncdata", "runtime", Go$Int32, ""]]);
	itab.init([["inter", "runtime", (go$ptrType(interfacetype)), ""], ["_type", "runtime", (go$ptrType(_type)), ""], ["link", "runtime", (go$ptrType(itab)), ""], ["bad", "runtime", Go$Int32, ""], ["unused", "runtime", Go$Int32, ""], ["fun", "runtime", (go$arrayType((go$funcType([], [], false)), 0)), ""]]);
	timers.init([["", "runtime", lock, ""], ["timerproc", "runtime", (go$ptrType(g)), ""], ["sleeping", "runtime", Go$Uint8, ""], ["rescheduling", "runtime", Go$Uint8, ""], ["waitnote", "runtime", note, ""], ["t", "runtime", (go$ptrType((go$ptrType(timer)))), ""], ["len", "runtime", Go$Int32, ""], ["cap", "runtime", Go$Int32, ""]]);
	timer.init([["i", "runtime", Go$Int32, ""], ["when", "runtime", Go$Int64, ""], ["period", "runtime", Go$Int64, ""], ["fv", "runtime", (go$ptrType(funcval)), ""], ["arg", "runtime", eface, ""]]);
	lfnode.init([["next", "runtime", (go$ptrType(lfnode)), ""], ["pushcnt", "runtime", Go$Uint64, ""]]);
	parfor.init([["body", "runtime", (go$funcType([(go$ptrType(parfor)), Go$Uint32], [], false)), ""], ["done", "runtime", Go$Uint32, ""], ["nthr", "runtime", Go$Uint32, ""], ["nthrmax", "runtime", Go$Uint32, ""], ["thrseq", "runtime", Go$Uint32, ""], ["cnt", "runtime", Go$Uint32, ""], ["ctx", "runtime", Go$UnsafePointer, ""], ["wait", "runtime", Go$Uint8, ""], ["thr", "runtime", (go$ptrType(parforthread)), ""], ["pad", "runtime", Go$Uint32, ""], ["nsteal", "runtime", Go$Uint64, ""], ["nstealcnt", "runtime", Go$Uint64, ""], ["nprocyield", "runtime", Go$Uint64, ""], ["nosyield", "runtime", Go$Uint64, ""], ["nsleep", "runtime", Go$Uint64, ""]]);
	cgomal.init([["next", "runtime", (go$ptrType(cgomal)), ""], ["alloc", "runtime", Go$UnsafePointer, ""]]);
	debugvars.init([["gctrace", "runtime", Go$Int32, ""], ["schedtrace", "runtime", Go$Int32, ""], ["scheddetail", "runtime", Go$Int32, ""]]);
	alg.init([["hash", "runtime", (go$funcType([(go$ptrType(Go$Uint64)), Go$Uint64, Go$UnsafePointer], [], false)), ""], ["equal", "runtime", (go$funcType([(go$ptrType(Go$Uint8)), Go$Uint64, Go$UnsafePointer, Go$UnsafePointer], [], false)), ""], ["print", "runtime", (go$funcType([Go$Uint64, Go$UnsafePointer], [], false)), ""], ["copy", "runtime", (go$funcType([Go$Uint64, Go$UnsafePointer, Go$UnsafePointer], [], false)), ""]]);
	_defer.init([["siz", "runtime", Go$Int32, ""], ["special", "runtime", Go$Uint8, ""], ["free", "runtime", Go$Uint8, ""], ["argp", "runtime", (go$ptrType(Go$Uint8)), ""], ["pc", "runtime", (go$ptrType(Go$Uint8)), ""], ["fn", "runtime", (go$ptrType(funcval)), ""], ["link", "runtime", (go$ptrType(_defer)), ""], ["args", "runtime", (go$arrayType(Go$UnsafePointer, 1)), ""]]);
	deferchunk.init([["prev", "runtime", (go$ptrType(deferchunk)), ""], ["off", "runtime", Go$Uint64, ""]]);
	_panic.init([["arg", "runtime", eface, ""], ["stackbase", "runtime", Go$Uint64, ""], ["link", "runtime", (go$ptrType(_panic)), ""], ["recovered", "runtime", Go$Uint8, ""]]);
	stkframe.init([["fn", "runtime", (go$ptrType(_func)), ""], ["pc", "runtime", Go$Uint64, ""], ["lr", "runtime", Go$Uint64, ""], ["sp", "runtime", Go$Uint64, ""], ["fp", "runtime", Go$Uint64, ""], ["varp", "runtime", (go$ptrType(Go$Uint8)), ""], ["argp", "runtime", (go$ptrType(Go$Uint8)), ""], ["arglen", "runtime", Go$Uint64, ""]]);
	mlink.init([["next", "runtime", (go$ptrType(mlink)), ""]]);
	fixalloc.init([["size", "runtime", Go$Uint64, ""], ["first", "runtime", (go$funcType([Go$UnsafePointer, (go$ptrType(Go$Uint8))], [], false)), ""], ["arg", "runtime", Go$UnsafePointer, ""], ["list", "runtime", (go$ptrType(mlink)), ""], ["chunk", "runtime", (go$ptrType(Go$Uint8)), ""], ["nchunk", "runtime", Go$Uint32, ""], ["inuse", "runtime", Go$Uint64, ""], ["stat", "runtime", (go$ptrType(Go$Uint64)), ""]]);
	_1_.init([["size", "runtime", Go$Uint32, ""], ["nmalloc", "runtime", Go$Uint64, ""], ["nfree", "runtime", Go$Uint64, ""]]);
	mstats.init([["alloc", "runtime", Go$Uint64, ""], ["total_alloc", "runtime", Go$Uint64, ""], ["sys", "runtime", Go$Uint64, ""], ["nlookup", "runtime", Go$Uint64, ""], ["nmalloc", "runtime", Go$Uint64, ""], ["nfree", "runtime", Go$Uint64, ""], ["heap_alloc", "runtime", Go$Uint64, ""], ["heap_sys", "runtime", Go$Uint64, ""], ["heap_idle", "runtime", Go$Uint64, ""], ["heap_inuse", "runtime", Go$Uint64, ""], ["heap_released", "runtime", Go$Uint64, ""], ["heap_objects", "runtime", Go$Uint64, ""], ["stacks_inuse", "runtime", Go$Uint64, ""], ["stacks_sys", "runtime", Go$Uint64, ""], ["mspan_inuse", "runtime", Go$Uint64, ""], ["mspan_sys", "runtime", Go$Uint64, ""], ["mcache_inuse", "runtime", Go$Uint64, ""], ["mcache_sys", "runtime", Go$Uint64, ""], ["buckhash_sys", "runtime", Go$Uint64, ""], ["gc_sys", "runtime", Go$Uint64, ""], ["other_sys", "runtime", Go$Uint64, ""], ["next_gc", "runtime", Go$Uint64, ""], ["last_gc", "runtime", Go$Uint64, ""], ["pause_total_ns", "runtime", Go$Uint64, ""], ["pause_ns", "runtime", (go$arrayType(Go$Uint64, 256)), ""], ["numgc", "runtime", Go$Uint32, ""], ["enablegc", "runtime", Go$Uint8, ""], ["debuggc", "runtime", Go$Uint8, ""], ["by_size", "runtime", (go$arrayType(_1_, 61)), ""]]);
	mcachelist.init([["list", "runtime", (go$ptrType(mlink)), ""], ["nlist", "runtime", Go$Uint32, ""]]);
	mcache.init([["next_sample", "runtime", Go$Int32, ""], ["local_cachealloc", "runtime", Go$Int64, ""], ["list", "runtime", (go$arrayType(mcachelist, 61)), ""], ["local_nlookup", "runtime", Go$Uint64, ""], ["local_largefree", "runtime", Go$Uint64, ""], ["local_nlargefree", "runtime", Go$Uint64, ""], ["local_nsmallfree", "runtime", (go$arrayType(Go$Uint64, 61)), ""]]);
	mtypes.init([["compression", "runtime", Go$Uint8, ""], ["data", "runtime", Go$Uint64, ""]]);
	mspan.init([["next", "runtime", (go$ptrType(mspan)), ""], ["prev", "runtime", (go$ptrType(mspan)), ""], ["start", "runtime", Go$Uint64, ""], ["npages", "runtime", Go$Uint64, ""], ["freelist", "runtime", (go$ptrType(mlink)), ""], ["ref", "runtime", Go$Uint32, ""], ["sizeclass", "runtime", Go$Int32, ""], ["elemsize", "runtime", Go$Uint64, ""], ["state", "runtime", Go$Uint32, ""], ["unusedsince", "runtime", Go$Int64, ""], ["npreleased", "runtime", Go$Uint64, ""], ["limit", "runtime", (go$ptrType(Go$Uint8)), ""], ["types", "runtime", mtypes, ""]]);
	mcentral.init([["", "runtime", lock, ""], ["sizeclass", "runtime", Go$Int32, ""], ["nonempty", "runtime", mspan, ""], ["empty", "runtime", mspan, ""], ["nfree", "runtime", Go$Int32, ""]]);
	_2_.init([["", "runtime", mcentral, ""], ["pad", "runtime", (go$arrayType(Go$Uint8, 64)), ""]]);
	mheap.init([["", "runtime", lock, ""], ["free", "runtime", (go$arrayType(mspan, 256)), ""], ["large", "runtime", mspan, ""], ["allspans", "runtime", (go$ptrType((go$ptrType(mspan)))), ""], ["nspan", "runtime", Go$Uint32, ""], ["nspancap", "runtime", Go$Uint32, ""], ["spans", "runtime", (go$ptrType((go$ptrType(mspan)))), ""], ["spans_mapped", "runtime", Go$Uint64, ""], ["bitmap", "runtime", (go$ptrType(Go$Uint8)), ""], ["bitmap_mapped", "runtime", Go$Uint64, ""], ["arena_start", "runtime", (go$ptrType(Go$Uint8)), ""], ["arena_used", "runtime", (go$ptrType(Go$Uint8)), ""], ["arena_end", "runtime", (go$ptrType(Go$Uint8)), ""], ["central", "runtime", (go$arrayType(_2_, 61)), ""], ["spanalloc", "runtime", fixalloc, ""], ["cachealloc", "runtime", fixalloc, ""], ["largefree", "runtime", Go$Uint64, ""], ["nlargefree", "runtime", Go$Uint64, ""], ["nsmallfree", "runtime", (go$arrayType(Go$Uint64, 61)), ""]]);
	_type.init([["size", "runtime", Go$Uint64, ""], ["hash", "runtime", Go$Uint32, ""], ["_unused", "runtime", Go$Uint8, ""], ["align", "runtime", Go$Uint8, ""], ["fieldalign", "runtime", Go$Uint8, ""], ["kind", "runtime", Go$Uint8, ""], ["alg", "runtime", (go$ptrType(alg)), ""], ["gc", "runtime", Go$UnsafePointer, ""], ["_string", "runtime", (go$ptrType(Go$String)), ""], ["x", "runtime", (go$ptrType(uncommontype)), ""], ["ptrto", "runtime", (go$ptrType(_type)), ""]]);
	method.init([["name", "runtime", (go$ptrType(Go$String)), ""], ["pkgpath", "runtime", (go$ptrType(Go$String)), ""], ["mtyp", "runtime", (go$ptrType(_type)), ""], ["typ", "runtime", (go$ptrType(_type)), ""], ["ifn", "runtime", (go$funcType([], [], false)), ""], ["tfn", "runtime", (go$funcType([], [], false)), ""]]);
	uncommontype.init([["name", "runtime", (go$ptrType(Go$String)), ""], ["pkgpath", "runtime", (go$ptrType(Go$String)), ""], ["mhdr", "runtime", (go$sliceType(Go$Uint8)), ""], ["m", "runtime", (go$arrayType(method, 0)), ""]]);
	imethod.init([["name", "runtime", (go$ptrType(Go$String)), ""], ["pkgpath", "runtime", (go$ptrType(Go$String)), ""], ["_type", "runtime", (go$ptrType(_type)), ""]]);
	interfacetype.init([["", "runtime", _type, ""], ["mhdr", "runtime", (go$sliceType(Go$Uint8)), ""], ["m", "runtime", (go$arrayType(imethod, 0)), ""]]);
	maptype.init([["", "runtime", _type, ""], ["key", "runtime", (go$ptrType(_type)), ""], ["elem", "runtime", (go$ptrType(_type)), ""], ["bucket", "runtime", (go$ptrType(_type)), ""], ["hmap", "runtime", (go$ptrType(_type)), ""]]);
	chantype.init([["", "runtime", _type, ""], ["elem", "runtime", (go$ptrType(_type)), ""], ["dir", "runtime", Go$Uint64, ""]]);
	slicetype.init([["", "runtime", _type, ""], ["elem", "runtime", (go$ptrType(_type)), ""]]);
	functype.init([["", "runtime", _type, ""], ["dotdotdot", "runtime", Go$Uint8, ""], ["in", "runtime", (go$sliceType(Go$Uint8)), ""], ["out", "runtime", (go$sliceType(Go$Uint8)), ""]]);
	ptrtype.init([["", "runtime", _type, ""], ["elem", "runtime", (go$ptrType(_type)), ""]]);
	sched.init([["", "runtime", lock, ""], ["goidgen", "runtime", Go$Uint64, ""], ["midle", "runtime", (go$ptrType(m)), ""], ["nmidle", "runtime", Go$Int32, ""], ["nmidlelocked", "runtime", Go$Int32, ""], ["mcount", "runtime", Go$Int32, ""], ["maxmcount", "runtime", Go$Int32, ""], ["pidle", "runtime", (go$ptrType(p)), ""], ["npidle", "runtime", Go$Uint32, ""], ["nmspinning", "runtime", Go$Uint32, ""], ["runqhead", "runtime", (go$ptrType(g)), ""], ["runqtail", "runtime", (go$ptrType(g)), ""], ["runqsize", "runtime", Go$Int32, ""], ["gflock", "runtime", lock, ""], ["gfree", "runtime", (go$ptrType(g)), ""], ["gcwaiting", "runtime", Go$Uint32, ""], ["stopwait", "runtime", Go$Int32, ""], ["stopnote", "runtime", note, ""], ["sysmonwait", "runtime", Go$Uint32, ""], ["sysmonnote", "runtime", note, ""], ["lastpoll", "runtime", Go$Uint64, ""], ["profilehz", "runtime", Go$Int32, ""]]);
	cgothreadstart.init([["m", "runtime", (go$ptrType(m)), ""], ["g", "runtime", (go$ptrType(g)), ""], ["fn", "runtime", (go$funcType([], [], false)), ""]]);
	_3_.init([["", "runtime", lock, ""], ["fn", "runtime", (go$funcType([(go$ptrType(Go$Uint64)), Go$Int32], [], false)), ""], ["hz", "runtime", Go$Int32, ""], ["pcbuf", "runtime", (go$arrayType(Go$Uint64, 100)), ""]]);
	pdesc.init([["schedtick", "runtime", Go$Uint32, ""], ["schedwhen", "runtime", Go$Int64, ""], ["syscalltick", "runtime", Go$Uint32, ""], ["syscallwhen", "runtime", Go$Int64, ""]]);
	bucket.init([["tophash", "runtime", (go$arrayType(Go$Uint8, 8)), ""], ["overflow", "runtime", (go$ptrType(bucket)), ""], ["data", "runtime", (go$arrayType(Go$Uint8, 1)), ""]]);
	hmap.init([["count", "runtime", Go$Uint64, ""], ["flags", "runtime", Go$Uint32, ""], ["hash0", "runtime", Go$Uint32, ""], ["b", "runtime", Go$Uint8, ""], ["keysize", "runtime", Go$Uint8, ""], ["valuesize", "runtime", Go$Uint8, ""], ["bucketsize", "runtime", Go$Uint16, ""], ["buckets", "runtime", (go$ptrType(Go$Uint8)), ""], ["oldbuckets", "runtime", (go$ptrType(Go$Uint8)), ""], ["nevacuate", "runtime", Go$Uint64, ""]]);
	hash_iter.init([["key", "runtime", (go$ptrType(Go$Uint8)), ""], ["value", "runtime", (go$ptrType(Go$Uint8)), ""], ["t", "runtime", (go$ptrType(maptype)), ""], ["h", "runtime", (go$ptrType(hmap)), ""], ["endbucket", "runtime", Go$Uint64, ""], ["wrapped", "runtime", Go$Uint8, ""], ["b", "runtime", Go$Uint8, ""], ["buckets", "runtime", (go$ptrType(Go$Uint8)), ""], ["bucket", "runtime", Go$Uint64, ""], ["bptr", "runtime", (go$ptrType(bucket)), ""], ["i", "runtime", Go$Uint64, ""], ["check_bucket", "runtime", Go$Int64, ""]]);
	sudog.init([["g", "runtime", (go$ptrType(g)), ""], ["selgen", "runtime", Go$Uint32, ""], ["link", "runtime", (go$ptrType(sudog)), ""], ["releasetime", "runtime", Go$Int64, ""], ["elem", "runtime", (go$ptrType(Go$Uint8)), ""]]);
	waitq.init([["first", "runtime", (go$ptrType(sudog)), ""], ["last", "runtime", (go$ptrType(sudog)), ""]]);
	hchan.init([["qcount", "runtime", Go$Uint64, ""], ["dataqsiz", "runtime", Go$Uint64, ""], ["elemsize", "runtime", Go$Uint16, ""], ["pad", "runtime", Go$Uint16, ""], ["closed", "runtime", Go$Uint8, ""], ["elemalg", "runtime", (go$ptrType(alg)), ""], ["sendx", "runtime", Go$Uint64, ""], ["recvx", "runtime", Go$Uint64, ""], ["recvq", "runtime", waitq, ""], ["sendq", "runtime", waitq, ""], ["", "runtime", lock, ""]]);
	scase.init([["sg", "runtime", sudog, ""], ["_chan", "runtime", (go$ptrType(hchan)), ""], ["pc", "runtime", (go$ptrType(Go$Uint8)), ""], ["kind", "runtime", Go$Uint16, ""], ["so", "runtime", Go$Uint16, ""], ["receivedp", "runtime", (go$ptrType(Go$Uint8)), ""]]);
	_select.init([["tcase", "runtime", Go$Uint16, ""], ["ncase", "runtime", Go$Uint16, ""], ["pollorder", "runtime", (go$ptrType(Go$Uint16)), ""], ["lockorder", "runtime", (go$ptrType((go$ptrType(hchan)))), ""], ["scase", "runtime", (go$arrayType(scase, 1)), ""]]);
	runtimeselect.init([["dir", "runtime", Go$Uint64, ""], ["typ", "runtime", (go$ptrType(chantype)), ""], ["ch", "runtime", (go$ptrType(hchan)), ""], ["val", "runtime", Go$Uint64, ""]]);
	parforthread.init([["pos", "runtime", Go$Uint64, ""], ["nsteal", "runtime", Go$Uint64, ""], ["nstealcnt", "runtime", Go$Uint64, ""], ["nprocyield", "runtime", Go$Uint64, ""], ["nosyield", "runtime", Go$Uint64, ""], ["nsleep", "runtime", Go$Uint64, ""], ["pad", "runtime", (go$arrayType(Go$Uint8, 64)), ""]]);
	var sizeof_C_MStats, memStats, precisestack, algarray, startup_random_data, startup_random_data_len, emptystring, zerobase, allg, lastg, allm, allp, gomaxprocs, needextram, panicking, goos, ncpu, iscgo, sysargs, maxstring, hchansize, cpuid_ecx, cpuid_edx, debug, maxstacksize, blockprofilerate, worldsema, nan, posinf, neginf, memstats, class_to_size, class_to_allocnpages, size_to_class8, size_to_class128, checking, m0, g0, extram, newprocs, scavenger, initdone, _cgo_thread_start, prof, experiment, hash, ifacelock, typelink, etypelink, empty_value, hashload;
	var Breakpoint = go$pkg.Breakpoint = function() {
		throw go$panic("Native function not implemented: Breakpoint");
	};
	var LockOSThread = go$pkg.LockOSThread = function() {
		throw go$panic("Native function not implemented: LockOSThread");
	};
	var UnlockOSThread = go$pkg.UnlockOSThread = function() {
		throw go$panic("Native function not implemented: UnlockOSThread");
	};
	var GOMAXPROCS = go$pkg.GOMAXPROCS = function(n) {
			if (n > 1) {
				go$notSupported("GOMAXPROCS != 1");
			}
			return 1;
		};
	var NumCPU = go$pkg.NumCPU = function() { return 1; };
	var NumCgoCall = go$pkg.NumCgoCall = function() {
		throw go$panic("Native function not implemented: NumCgoCall");
	};
	var NumGoroutine = go$pkg.NumGoroutine = function() {
		throw go$panic("Native function not implemented: NumGoroutine");
	};
	MemProfileRecord.Ptr.prototype.InUseBytes = function() {
		var r, x, x$1;
		r = this;
		return (x = r.AllocBytes, x$1 = r.FreeBytes, new Go$Int64(x.high - x$1.high, x.low - x$1.low));
	};
	MemProfileRecord.prototype.InUseBytes = function() { return this.go$val.InUseBytes(); };
	MemProfileRecord.Ptr.prototype.InUseObjects = function() {
		var r, x, x$1;
		r = this;
		return (x = r.AllocObjects, x$1 = r.FreeObjects, new Go$Int64(x.high - x$1.high, x.low - x$1.low));
	};
	MemProfileRecord.prototype.InUseObjects = function() { return this.go$val.InUseObjects(); };
	MemProfileRecord.Ptr.prototype.Stack = function() {
		var r, _ref, _i, v, i;
		r = this;
		_ref = r.Stack0;
		_i = 0;
		while (_i < 32) {
			v = _ref[_i];
			i = _i;
			if (v === 0) {
				return go$subslice(new (go$sliceType(Go$Uintptr))(r.Stack0), 0, i);
			}
			_i++;
		}
		return go$subslice(new (go$sliceType(Go$Uintptr))(r.Stack0), 0);
	};
	MemProfileRecord.prototype.Stack = function() { return this.go$val.Stack(); };
	var MemProfile = go$pkg.MemProfile = function(p$1, inuseZero) {
		throw go$panic("Native function not implemented: MemProfile");
	};
	StackRecord.Ptr.prototype.Stack = function() {
		var r, _ref, _i, v, i;
		r = this;
		_ref = r.Stack0;
		_i = 0;
		while (_i < 32) {
			v = _ref[_i];
			i = _i;
			if (v === 0) {
				return go$subslice(new (go$sliceType(Go$Uintptr))(r.Stack0), 0, i);
			}
			_i++;
		}
		return go$subslice(new (go$sliceType(Go$Uintptr))(r.Stack0), 0);
	};
	StackRecord.prototype.Stack = function() { return this.go$val.Stack(); };
	var ThreadCreateProfile = go$pkg.ThreadCreateProfile = function(p$1) {
		throw go$panic("Native function not implemented: ThreadCreateProfile");
	};
	var GoroutineProfile = go$pkg.GoroutineProfile = function(p$1) {
		throw go$panic("Native function not implemented: GoroutineProfile");
	};
	var CPUProfile = go$pkg.CPUProfile = function() {
		throw go$panic("Native function not implemented: CPUProfile");
	};
	var SetCPUProfileRate = go$pkg.SetCPUProfileRate = function(hz) {
		throw go$panic("Native function not implemented: SetCPUProfileRate");
	};
	var SetBlockProfileRate = go$pkg.SetBlockProfileRate = function(rate) {
		throw go$panic("Native function not implemented: SetBlockProfileRate");
	};
	var BlockProfile = go$pkg.BlockProfile = function(p$1) {
		throw go$panic("Native function not implemented: BlockProfile");
	};
	var Stack = go$pkg.Stack = function(buf, all) {
		throw go$panic("Native function not implemented: Stack");
	};
	TypeAssertionError.Ptr.prototype.RuntimeError = function() {
	};
	TypeAssertionError.prototype.RuntimeError = function() { return this.go$val.RuntimeError(); };
	TypeAssertionError.Ptr.prototype.Error = function() {
		var e, inter;
		e = this;
		inter = e.interfaceString;
		if (inter === "") {
			inter = "interface";
		}
		if (e.concreteString === "") {
			return "interface conversion: " + inter + " is nil, not " + e.assertedString;
		}
		if (e.missingMethod === "") {
			return "interface conversion: " + inter + " is " + e.concreteString + ", not " + e.assertedString;
		}
		return "interface conversion: " + e.concreteString + " is not " + e.assertedString + ": missing method " + e.missingMethod;
	};
	TypeAssertionError.prototype.Error = function() { return this.go$val.Error(); };
	var newTypeAssertionError = function(ps1, ps2, ps3, pmeth, ret) {
		var _tuple, s1, s2, s3, meth;
		_tuple = ["", "", "", ""], s1 = _tuple[0], s2 = _tuple[1], s3 = _tuple[2], meth = _tuple[3];
		if (!(go$pointerIsEqual(ps1, (go$ptrType(Go$String)).nil))) {
			s1 = ps1.go$get();
		}
		if (!(go$pointerIsEqual(ps2, (go$ptrType(Go$String)).nil))) {
			s2 = ps2.go$get();
		}
		if (!(go$pointerIsEqual(ps3, (go$ptrType(Go$String)).nil))) {
			s3 = ps3.go$get();
		}
		if (!(go$pointerIsEqual(pmeth, (go$ptrType(Go$String)).nil))) {
			meth = pmeth.go$get();
		}
		ret.go$set(new TypeAssertionError.Ptr(s1, s2, s3, meth));
	};
	errorString.prototype.RuntimeError = function() {
		var e;
		e = this.go$val;
	};
	go$ptrType(errorString).prototype.RuntimeError = function() { return new errorString(this.go$get()).RuntimeError(); };
	errorString.prototype.Error = function() {
		var e;
		e = this.go$val;
		return "runtime error: " + e;
	};
	go$ptrType(errorString).prototype.Error = function() { return new errorString(this.go$get()).Error(); };
	var newErrorString = function(s, ret) {
		ret.go$set(new errorString(s));
	};
	errorCString.prototype.RuntimeError = function() {
		var e;
		e = this.go$val;
	};
	go$ptrType(errorCString).prototype.RuntimeError = function() { return new errorCString(this.go$get()).RuntimeError(); };
	var cstringToGo = function() {
		throw go$panic("Native function not implemented: cstringToGo");
	};
	errorCString.prototype.Error = function() {
		var e;
		e = this.go$val;
		return "runtime error: " + cstringToGo((e >>> 0));
	};
	go$ptrType(errorCString).prototype.Error = function() { return new errorCString(this.go$get()).Error(); };
	var newErrorCString = function(s, ret) {
		ret.go$set(new errorCString((s >>> 0)));
	};
	var typestring = function() {
		throw go$panic("Native function not implemented: typestring");
	};
	var printany = function(i) {
		var v, _ref, _type$1;
		_ref = i;
		_type$1 = _ref !== null ? _ref.constructor : null;
		if (_type$1 === null) {
			v = _ref;
			console.log("nil");
		} else if (stringer.implementedBy.indexOf(_type$1) !== -1) {
			v = _ref;
			console.log(v.String());
		} else if (go$error.implementedBy.indexOf(_type$1) !== -1) {
			v = _ref;
			console.log(v.Error());
		} else if (_type$1 === Go$Int) {
			v = _ref.go$val;
			console.log(v);
		} else if (_type$1 === Go$String) {
			v = _ref.go$val;
			console.log(v);
		} else {
			v = _ref;
			console.log("(", typestring(i), ") ", i);
		}
	};
	var panicwrap = function(pkg, typ, meth) {
		throw go$panic(new Go$String("value method " + pkg + "." + typ + "." + meth + " called using nil *" + typ + " pointer"));
	};
	var Gosched = go$pkg.Gosched = function() {
		throw go$panic("Native function not implemented: Gosched");
	};
	var Goexit = go$pkg.Goexit = function() {
			var err = new Go$Error();
			err.go$exit = true;
			throw err;
		};
	var Caller = go$pkg.Caller = function(skip) {
			var line = go$getStack()[skip + 3];
			if (line === undefined) {
				return [0, "", 0, false];
			}
			var parts = line.substring(line.indexOf("(") + 1, line.indexOf(")")).split(":");
			return [0, parts[0], parseInt(parts[1]), true];
		};
	var Callers = go$pkg.Callers = function(skip, pc) {
		throw go$panic("Native function not implemented: Callers");
	};
	var FuncForPC = go$pkg.FuncForPC = function(pc) {
		throw go$panic("Native function not implemented: FuncForPC");
	};
	Func.Ptr.prototype.Name = function() {
		var f;
		f = this;
		return funcname_go(f);
	};
	Func.prototype.Name = function() { return this.go$val.Name(); };
	Func.Ptr.prototype.Entry = function() {
		var f;
		f = this;
		return funcentry_go(f);
	};
	Func.prototype.Entry = function() { return this.go$val.Entry(); };
	Func.Ptr.prototype.FileLine = function(pc) {
		var file, line, f, _tuple;
		file = "";
		line = 0;
		f = this;
		_tuple = funcline_go(f, pc), file = _tuple[0], line = _tuple[1];
		return [file, line];
	};
	Func.prototype.FileLine = function(pc) { return this.go$val.FileLine(pc); };
	var funcline_go = function() {
		throw go$panic("Native function not implemented: funcline_go");
	};
	var funcname_go = function() {
		throw go$panic("Native function not implemented: funcname_go");
	};
	var funcentry_go = function() {
		throw go$panic("Native function not implemented: funcentry_go");
	};
	var SetFinalizer = go$pkg.SetFinalizer = function() {};
	var getgoroot = function() {
			return (typeof process !== 'undefined') ? (process.env["GOROOT"] || "") : "/";
		};
	var GOROOT = go$pkg.GOROOT = function() {
		var s;
		s = getgoroot();
		if (!(s === "")) {
			return s;
		}
		return "c:\\go";
	};
	var Version = go$pkg.Version = function() {
		return "go1.2";
	};
	var ReadMemStats = go$pkg.ReadMemStats = function() {};
	var GC = go$pkg.GC = function() {};
	var gc_m_ptr = function(ret) {
		ret.go$set((go$ptrType(m)).nil);
	};
	var gc_itab_ptr = function(ret) {
		ret.go$set((go$ptrType(itab)).nil);
	};
	var funpack64 = function(f) {
		var sign, mant, exp, inf, nan$1, _ref;
		sign = new Go$Uint64(0, 0);
		mant = new Go$Uint64(0, 0);
		exp = 0;
		inf = false;
		nan$1 = false;
		sign = new Go$Uint64(f.high & 2147483648, (f.low & 0) >>> 0);
		mant = new Go$Uint64(f.high & 1048575, (f.low & 4294967295) >>> 0);
		exp = (go$shiftRightUint64(f, 52).low >> 0) & 2047;
		_ref = exp;
		if (_ref === 2047) {
			if (!((mant.high === 0 && mant.low === 0))) {
				nan$1 = true;
				return [sign, mant, exp, inf, nan$1];
			}
			inf = true;
			return [sign, mant, exp, inf, nan$1];
		} else if (_ref === 0) {
			if (!((mant.high === 0 && mant.low === 0))) {
				exp = exp + -1022 >> 0;
				while ((mant.high < 1048576 || (mant.high === 1048576 && mant.low < 0))) {
					mant = go$shiftLeft64(mant, 1);
					exp = exp - 1 >> 0;
				}
			}
		} else {
			mant = new Go$Uint64(mant.high | 1048576, (mant.low | 0) >>> 0);
			exp = exp + -1023 >> 0;
		}
		return [sign, mant, exp, inf, nan$1];
	};
	var funpack32 = function(f) {
		var sign, mant, exp, inf, nan$1, _ref;
		sign = 0;
		mant = 0;
		exp = 0;
		inf = false;
		nan$1 = false;
		sign = (f & 2147483648) >>> 0;
		mant = (f & 8388607) >>> 0;
		exp = ((f >>> 23 >>> 0) >> 0) & 255;
		_ref = exp;
		if (_ref === 255) {
			if (!((mant === 0))) {
				nan$1 = true;
				return [sign, mant, exp, inf, nan$1];
			}
			inf = true;
			return [sign, mant, exp, inf, nan$1];
		} else if (_ref === 0) {
			if (!((mant === 0))) {
				exp = exp + -126 >> 0;
				while (mant < 8388608) {
					mant = mant << 1 >>> 0;
					exp = exp - 1 >> 0;
				}
			}
		} else {
			mant = (mant | 8388608) >>> 0;
			exp = exp + -127 >> 0;
		}
		return [sign, mant, exp, inf, nan$1];
	};
	var fpack64 = function(sign, mant, exp, trunc) {
		var _tuple, mant0, exp0, trunc0, x, x$1, x$2, _tuple$1, x$3, x$4, x$5, x$6, x$7, x$8;
		_tuple = [mant, exp, trunc], mant0 = _tuple[0], exp0 = _tuple[1], trunc0 = _tuple[2];
		if ((mant.high === 0 && mant.low === 0)) {
			return sign;
		}
		while ((mant.high < 1048576 || (mant.high === 1048576 && mant.low < 0))) {
			mant = go$shiftLeft64(mant, 1);
			exp = exp - 1 >> 0;
		}
		while ((mant.high > 4194304 || (mant.high === 4194304 && mant.low >= 0))) {
			trunc = (x = new Go$Uint64(mant.high & 0, (mant.low & 1) >>> 0), new Go$Uint64(trunc.high | x.high, (trunc.low | x.low) >>> 0));
			mant = go$shiftRightUint64(mant, 1);
			exp = exp + 1 >> 0;
		}
		if ((mant.high > 2097152 || (mant.high === 2097152 && mant.low >= 0))) {
			if (!((x$1 = new Go$Uint64(mant.high & 0, (mant.low & 1) >>> 0), (x$1.high === 0 && x$1.low === 0))) && (!((trunc.high === 0 && trunc.low === 0)) || !((x$2 = new Go$Uint64(mant.high & 0, (mant.low & 2) >>> 0), (x$2.high === 0 && x$2.low === 0))))) {
				mant = new Go$Uint64(mant.high + 0, mant.low + 1);
				if ((mant.high > 4194304 || (mant.high === 4194304 && mant.low >= 0))) {
					mant = go$shiftRightUint64(mant, 1);
					exp = exp + 1 >> 0;
				}
			}
			mant = go$shiftRightUint64(mant, 1);
			exp = exp + 1 >> 0;
		}
		if (exp >= 1024) {
			return new Go$Uint64(sign.high ^ 2146435072, (sign.low ^ 0) >>> 0);
		}
		if (exp < -1022) {
			if (exp < -1075) {
				return new Go$Uint64(sign.high | 0, (sign.low | 0) >>> 0);
			}
			_tuple$1 = [mant0, exp0, trunc0], mant = _tuple$1[0], exp = _tuple$1[1], trunc = _tuple$1[2];
			while (exp < -1023) {
				trunc = (x$3 = new Go$Uint64(mant.high & 0, (mant.low & 1) >>> 0), new Go$Uint64(trunc.high | x$3.high, (trunc.low | x$3.low) >>> 0));
				mant = go$shiftRightUint64(mant, 1);
				exp = exp + 1 >> 0;
			}
			if (!((x$4 = new Go$Uint64(mant.high & 0, (mant.low & 1) >>> 0), (x$4.high === 0 && x$4.low === 0))) && (!((trunc.high === 0 && trunc.low === 0)) || !((x$5 = new Go$Uint64(mant.high & 0, (mant.low & 2) >>> 0), (x$5.high === 0 && x$5.low === 0))))) {
				mant = new Go$Uint64(mant.high + 0, mant.low + 1);
			}
			mant = go$shiftRightUint64(mant, 1);
			exp = exp + 1 >> 0;
			if ((mant.high < 1048576 || (mant.high === 1048576 && mant.low < 0))) {
				return new Go$Uint64(sign.high | mant.high, (sign.low | mant.low) >>> 0);
			}
		}
		return (x$6 = (x$7 = go$shiftLeft64(new Go$Uint64(0, (exp - -1023 >> 0)), 52), new Go$Uint64(sign.high | x$7.high, (sign.low | x$7.low) >>> 0)), x$8 = new Go$Uint64(mant.high & 1048575, (mant.low & 4294967295) >>> 0), new Go$Uint64(x$6.high | x$8.high, (x$6.low | x$8.low) >>> 0));
	};
	var fpack32 = function(sign, mant, exp, trunc) {
		var _tuple, mant0, exp0, trunc0, _tuple$1;
		_tuple = [mant, exp, trunc], mant0 = _tuple[0], exp0 = _tuple[1], trunc0 = _tuple[2];
		if (mant === 0) {
			return sign;
		}
		while (mant < 8388608) {
			mant = mant << 1 >>> 0;
			exp = exp - 1 >> 0;
		}
		while (mant >= 33554432) {
			trunc = (trunc | (((mant & 1) >>> 0))) >>> 0;
			mant = mant >>> 1 >>> 0;
			exp = exp + 1 >> 0;
		}
		if (mant >= 16777216) {
			if (!((((mant & 1) >>> 0) === 0)) && (!((trunc === 0)) || !((((mant & 2) >>> 0) === 0)))) {
				mant = mant + 1 >>> 0;
				if (mant >= 33554432) {
					mant = mant >>> 1 >>> 0;
					exp = exp + 1 >> 0;
				}
			}
			mant = mant >>> 1 >>> 0;
			exp = exp + 1 >> 0;
		}
		if (exp >= 128) {
			return (sign ^ 2139095040) >>> 0;
		}
		if (exp < -126) {
			if (exp < -150) {
				return (sign | 0) >>> 0;
			}
			_tuple$1 = [mant0, exp0, trunc0], mant = _tuple$1[0], exp = _tuple$1[1], trunc = _tuple$1[2];
			while (exp < -127) {
				trunc = (trunc | (((mant & 1) >>> 0))) >>> 0;
				mant = mant >>> 1 >>> 0;
				exp = exp + 1 >> 0;
			}
			if (!((((mant & 1) >>> 0) === 0)) && (!((trunc === 0)) || !((((mant & 2) >>> 0) === 0)))) {
				mant = mant + 1 >>> 0;
			}
			mant = mant >>> 1 >>> 0;
			exp = exp + 1 >> 0;
			if (mant < 8388608) {
				return (sign | mant) >>> 0;
			}
		}
		return (((sign | (((exp - -127 >> 0) >>> 0) << 23 >>> 0)) >>> 0) | ((mant & 8388607) >>> 0)) >>> 0;
	};
	var fadd64 = function(f, g$1) {
		var _tuple, fs, fm, fe, fi, fn, _tuple$1, gs, gm, ge, gi, gn, x, _tuple$2, shift, x$1, x$2, trunc, x$3, x$4;
		_tuple = funpack64(f), fs = _tuple[0], fm = _tuple[1], fe = _tuple[2], fi = _tuple[3], fn = _tuple[4];
		_tuple$1 = funpack64(g$1), gs = _tuple$1[0], gm = _tuple$1[1], ge = _tuple$1[2], gi = _tuple$1[3], gn = _tuple$1[4];
		if (fn || gn) {
			return new Go$Uint64(2146435072, 1);
		} else if (fi && gi && !((fs.high === gs.high && fs.low === gs.low))) {
			return new Go$Uint64(2146435072, 1);
		} else if (fi) {
			return f;
		} else if (gi) {
			return g$1;
		} else if ((fm.high === 0 && fm.low === 0) && (gm.high === 0 && gm.low === 0) && !((fs.high === 0 && fs.low === 0)) && !((gs.high === 0 && gs.low === 0))) {
			return f;
		} else if ((fm.high === 0 && fm.low === 0)) {
			if ((gm.high === 0 && gm.low === 0)) {
				g$1 = (x = gs, new Go$Uint64(g$1.high ^ x.high, (g$1.low ^ x.low) >>> 0));
			}
			return g$1;
		} else if ((gm.high === 0 && gm.low === 0)) {
			return f;
		}
		if (fe < ge || (fe === ge) && (fm.high < gm.high || (fm.high === gm.high && fm.low < gm.low))) {
			_tuple$2 = [g$1, f, gs, gm, ge, fs, fm, fe], f = _tuple$2[0], g$1 = _tuple$2[1], fs = _tuple$2[2], fm = _tuple$2[3], fe = _tuple$2[4], gs = _tuple$2[5], gm = _tuple$2[6], ge = _tuple$2[7];
		}
		shift = ((fe - ge >> 0) >>> 0);
		fm = go$shiftLeft64(fm, 2);
		gm = go$shiftLeft64(gm, 2);
		trunc = (x$1 = (x$2 = go$shiftLeft64(new Go$Uint64(0, 1), shift), new Go$Uint64(x$2.high - 0, x$2.low - 1)), new Go$Uint64(gm.high & x$1.high, (gm.low & x$1.low) >>> 0));
		gm = go$shiftRightUint64(gm, (shift));
		if ((fs.high === gs.high && fs.low === gs.low)) {
			fm = (x$3 = gm, new Go$Uint64(fm.high + x$3.high, fm.low + x$3.low));
		} else {
			fm = (x$4 = gm, new Go$Uint64(fm.high - x$4.high, fm.low - x$4.low));
			if (!((trunc.high === 0 && trunc.low === 0))) {
				fm = new Go$Uint64(fm.high - 0, fm.low - 1);
			}
		}
		if ((fm.high === 0 && fm.low === 0)) {
			fs = new Go$Uint64(0, 0);
		}
		return fpack64(fs, fm, fe - 2 >> 0, trunc);
	};
	var fsub64 = function(f, g$1) {
		return fadd64(f, fneg64(g$1));
	};
	var fneg64 = function(f) {
		return new Go$Uint64(f.high ^ 2147483648, (f.low ^ 0) >>> 0);
	};
	var fmul64 = function(f, g$1) {
		var _tuple, fs, fm, fe, fi, fn, _tuple$1, gs, gm, ge, gi, gn, _tuple$2, lo, hi, shift, x, x$1, trunc, x$2, x$3, mant;
		_tuple = funpack64(f), fs = _tuple[0], fm = _tuple[1], fe = _tuple[2], fi = _tuple[3], fn = _tuple[4];
		_tuple$1 = funpack64(g$1), gs = _tuple$1[0], gm = _tuple$1[1], ge = _tuple$1[2], gi = _tuple$1[3], gn = _tuple$1[4];
		if (fn || gn) {
			return new Go$Uint64(2146435072, 1);
		} else if (fi && gi) {
			return new Go$Uint64(f.high ^ gs.high, (f.low ^ gs.low) >>> 0);
		} else if (fi && (gm.high === 0 && gm.low === 0) || (fm.high === 0 && fm.low === 0) && gi) {
			return new Go$Uint64(2146435072, 1);
		} else if ((fm.high === 0 && fm.low === 0)) {
			return new Go$Uint64(f.high ^ gs.high, (f.low ^ gs.low) >>> 0);
		} else if ((gm.high === 0 && gm.low === 0)) {
			return new Go$Uint64(g$1.high ^ fs.high, (g$1.low ^ fs.low) >>> 0);
		}
		_tuple$2 = mullu(fm, gm), lo = _tuple$2[0], hi = _tuple$2[1];
		shift = 51;
		trunc = (x = (x$1 = go$shiftLeft64(new Go$Uint64(0, 1), shift), new Go$Uint64(x$1.high - 0, x$1.low - 1)), new Go$Uint64(lo.high & x.high, (lo.low & x.low) >>> 0));
		mant = (x$2 = go$shiftLeft64(hi, ((64 - shift >>> 0))), x$3 = go$shiftRightUint64(lo, shift), new Go$Uint64(x$2.high | x$3.high, (x$2.low | x$3.low) >>> 0));
		return fpack64(new Go$Uint64(fs.high ^ gs.high, (fs.low ^ gs.low) >>> 0), mant, (fe + ge >> 0) - 1 >> 0, trunc);
	};
	var fdiv64 = function(f, g$1) {
		var _tuple, fs, fm, fe, fi, fn, _tuple$1, gs, gm, ge, gi, gn, x, x$1, _tuple$2, shift, _tuple$3, q, r;
		_tuple = funpack64(f), fs = _tuple[0], fm = _tuple[1], fe = _tuple[2], fi = _tuple[3], fn = _tuple[4];
		_tuple$1 = funpack64(g$1), gs = _tuple$1[0], gm = _tuple$1[1], ge = _tuple$1[2], gi = _tuple$1[3], gn = _tuple$1[4];
		if (fn || gn) {
			return new Go$Uint64(2146435072, 1);
		} else if (fi && gi) {
			return new Go$Uint64(2146435072, 1);
		} else if (!fi && !gi && (fm.high === 0 && fm.low === 0) && (gm.high === 0 && gm.low === 0)) {
			return new Go$Uint64(2146435072, 1);
		} else if (fi || !gi && (gm.high === 0 && gm.low === 0)) {
			return (x = new Go$Uint64(fs.high ^ gs.high, (fs.low ^ gs.low) >>> 0), new Go$Uint64(x.high ^ 2146435072, (x.low ^ 0) >>> 0));
		} else if (gi || (fm.high === 0 && fm.low === 0)) {
			return (x$1 = new Go$Uint64(fs.high ^ gs.high, (fs.low ^ gs.low) >>> 0), new Go$Uint64(x$1.high ^ 0, (x$1.low ^ 0) >>> 0));
		}
		_tuple$2 = [fi, fn, gi, gn];
		shift = 54;
		_tuple$3 = divlu(go$shiftRightUint64(fm, ((64 - shift >>> 0))), go$shiftLeft64(fm, shift), gm), q = _tuple$3[0], r = _tuple$3[1];
		return fpack64(new Go$Uint64(fs.high ^ gs.high, (fs.low ^ gs.low) >>> 0), q, (fe - ge >> 0) - 2 >> 0, r);
	};
	var f64to32 = function(f) {
		var _tuple, fs, fm, fe, fi, fn, fs32;
		_tuple = funpack64(f), fs = _tuple[0], fm = _tuple[1], fe = _tuple[2], fi = _tuple[3], fn = _tuple[4];
		if (fn) {
			return 2139095041;
		}
		fs32 = (go$shiftRightUint64(fs, 32).low >>> 0);
		if (fi) {
			return (fs32 ^ 2139095040) >>> 0;
		}
		return fpack32(fs32, (go$shiftRightUint64(fm, 28).low >>> 0), fe - 1 >> 0, (new Go$Uint64(fm.high & 0, (fm.low & 268435455) >>> 0).low >>> 0));
	};
	var f32to64 = function(f) {
		var _tuple, fs, fm, fe, fi, fn, fs64;
		_tuple = funpack32(f), fs = _tuple[0], fm = _tuple[1], fe = _tuple[2], fi = _tuple[3], fn = _tuple[4];
		if (fn) {
			return new Go$Uint64(2146435072, 1);
		}
		fs64 = go$shiftLeft64(new Go$Uint64(0, fs), 32);
		if (fi) {
			return new Go$Uint64(fs64.high ^ 2146435072, (fs64.low ^ 0) >>> 0);
		}
		return fpack64(fs64, go$shiftLeft64(new Go$Uint64(0, fm), 29), fe, new Go$Uint64(0, 0));
	};
	var fcmp64 = function(f, g$1) {
		var cmp, isnan, _tuple, fs, fm, fi, fn, _tuple$1, gs, gm, gi, gn, _tuple$2, _tuple$3, _tuple$4, _tuple$5, _tuple$6, _tuple$7, _tuple$8;
		cmp = 0;
		isnan = false;
		_tuple = funpack64(f), fs = _tuple[0], fm = _tuple[1], fi = _tuple[3], fn = _tuple[4];
		_tuple$1 = funpack64(g$1), gs = _tuple$1[0], gm = _tuple$1[1], gi = _tuple$1[3], gn = _tuple$1[4];
		if (fn || gn) {
			_tuple$2 = [0, true], cmp = _tuple$2[0], isnan = _tuple$2[1];
			return [cmp, isnan];
		} else if (!fi && !gi && (fm.high === 0 && fm.low === 0) && (gm.high === 0 && gm.low === 0)) {
			_tuple$3 = [0, false], cmp = _tuple$3[0], isnan = _tuple$3[1];
			return [cmp, isnan];
		} else if ((fs.high > gs.high || (fs.high === gs.high && fs.low > gs.low))) {
			_tuple$4 = [-1, false], cmp = _tuple$4[0], isnan = _tuple$4[1];
			return [cmp, isnan];
		} else if ((fs.high < gs.high || (fs.high === gs.high && fs.low < gs.low))) {
			_tuple$5 = [1, false], cmp = _tuple$5[0], isnan = _tuple$5[1];
			return [cmp, isnan];
		} else if ((fs.high === 0 && fs.low === 0) && (f.high < g$1.high || (f.high === g$1.high && f.low < g$1.low)) || !((fs.high === 0 && fs.low === 0)) && (f.high > g$1.high || (f.high === g$1.high && f.low > g$1.low))) {
			_tuple$6 = [-1, false], cmp = _tuple$6[0], isnan = _tuple$6[1];
			return [cmp, isnan];
		} else if ((fs.high === 0 && fs.low === 0) && (f.high > g$1.high || (f.high === g$1.high && f.low > g$1.low)) || !((fs.high === 0 && fs.low === 0)) && (f.high < g$1.high || (f.high === g$1.high && f.low < g$1.low))) {
			_tuple$7 = [1, false], cmp = _tuple$7[0], isnan = _tuple$7[1];
			return [cmp, isnan];
		}
		_tuple$8 = [0, false], cmp = _tuple$8[0], isnan = _tuple$8[1];
		return [cmp, isnan];
	};
	var f64toint = function(f) {
		var val, ok, _tuple, fs, fm, fe, fi, fn, _tuple$1, _tuple$2, _tuple$3, _tuple$4, _tuple$5, _tuple$6;
		val = new Go$Int64(0, 0);
		ok = false;
		_tuple = funpack64(f), fs = _tuple[0], fm = _tuple[1], fe = _tuple[2], fi = _tuple[3], fn = _tuple[4];
		if (fi || fn) {
			_tuple$1 = [new Go$Int64(0, 0), false], val = _tuple$1[0], ok = _tuple$1[1];
			return [val, ok];
		} else if (fe < -1) {
			_tuple$2 = [new Go$Int64(0, 0), false], val = _tuple$2[0], ok = _tuple$2[1];
			return [val, ok];
		} else if (fe > 63) {
			if (!((fs.high === 0 && fs.low === 0)) && (fm.high === 0 && fm.low === 0)) {
				_tuple$3 = [new Go$Int64(-2147483648, 0), true], val = _tuple$3[0], ok = _tuple$3[1];
				return [val, ok];
			}
			if (!((fs.high === 0 && fs.low === 0))) {
				_tuple$4 = [new Go$Int64(0, 0), false], val = _tuple$4[0], ok = _tuple$4[1];
				return [val, ok];
			}
			_tuple$5 = [new Go$Int64(0, 0), false], val = _tuple$5[0], ok = _tuple$5[1];
			return [val, ok];
		}
		while (fe > 52) {
			fe = fe - 1 >> 0;
			fm = go$shiftLeft64(fm, 1);
		}
		while (fe < 52) {
			fe = fe + 1 >> 0;
			fm = go$shiftRightUint64(fm, 1);
		}
		val = new Go$Int64(fm.high, fm.low);
		if (!((fs.high === 0 && fs.low === 0))) {
			val = new Go$Int64(-val.high, -val.low);
		}
		_tuple$6 = [val, true], val = _tuple$6[0], ok = _tuple$6[1];
		return [val, ok];
	};
	var fintto64 = function(val) {
		var f, x, fs, mant;
		f = new Go$Uint64(0, 0);
		fs = (x = new Go$Uint64(val.high, val.low), new Go$Uint64(x.high & 2147483648, (x.low & 0) >>> 0));
		mant = new Go$Uint64(val.high, val.low);
		if (!((fs.high === 0 && fs.low === 0))) {
			mant = new Go$Uint64(-mant.high, -mant.low);
		}
		f = fpack64(fs, mant, 52, new Go$Uint64(0, 0));
		return f;
	};
	var mullu = function(u, v) {
		var lo, hi, u0, u1, v0, v1, w0, x, x$1, t, w1, w2, x$2, x$3, x$4, x$5, _tuple;
		lo = new Go$Uint64(0, 0);
		hi = new Go$Uint64(0, 0);
		u0 = new Go$Uint64(u.high & 0, (u.low & 4294967295) >>> 0);
		u1 = go$shiftRightUint64(u, 32);
		v0 = new Go$Uint64(v.high & 0, (v.low & 4294967295) >>> 0);
		v1 = go$shiftRightUint64(v, 32);
		w0 = go$mul64(u0, v0);
		t = (x = go$mul64(u1, v0), x$1 = go$shiftRightUint64(w0, 32), new Go$Uint64(x.high + x$1.high, x.low + x$1.low));
		w1 = new Go$Uint64(t.high & 0, (t.low & 4294967295) >>> 0);
		w2 = go$shiftRightUint64(t, 32);
		w1 = (x$2 = go$mul64(u0, v1), new Go$Uint64(w1.high + x$2.high, w1.low + x$2.low));
		_tuple = [go$mul64(u, v), (x$3 = (x$4 = go$mul64(u1, v1), new Go$Uint64(x$4.high + w2.high, x$4.low + w2.low)), x$5 = go$shiftRightUint64(w1, 32), new Go$Uint64(x$3.high + x$5.high, x$3.low + x$5.low))], lo = _tuple[0], hi = _tuple[1];
		return [lo, hi];
	};
	var divlu = function(u1, u0, v) {
		var go$this = this, q, r, _tuple, s, x, vn1, vn0, x$1, x$2, un32, un10, un1, un0, q1, x$3, rhat, x$4, x$5, x$6, x$7, x$8, x$9, x$10, un21, q0, x$11, x$12, x$13, x$14, x$15, x$16, x$17, x$18, x$19, _tuple$1;
		q = new Go$Uint64(0, 0);
		r = new Go$Uint64(0, 0);
		/* */ var go$s = 0, go$f = function() { while (true) { switch (go$s) { case 0:
		if ((u1.high > v.high || (u1.high === v.high && u1.low >= v.low))) {
			_tuple = [new Go$Uint64(4294967295, 4294967295), new Go$Uint64(4294967295, 4294967295)], q = _tuple[0], r = _tuple[1];
			return [q, r];
		}
		s = 0;
		while ((x = new Go$Uint64(v.high & 2147483648, (v.low & 0) >>> 0), (x.high === 0 && x.low === 0))) {
			s = s + 1 >>> 0;
			v = go$shiftLeft64(v, 1);
		}
		vn1 = go$shiftRightUint64(v, 32);
		vn0 = new Go$Uint64(v.high & 0, (v.low & 4294967295) >>> 0);
		un32 = (x$1 = go$shiftLeft64(u1, s), x$2 = go$shiftRightUint64(u0, ((64 - s >>> 0))), new Go$Uint64(x$1.high | x$2.high, (x$1.low | x$2.low) >>> 0));
		un10 = go$shiftLeft64(u0, s);
		un1 = go$shiftRightUint64(un10, 32);
		un0 = new Go$Uint64(un10.high & 0, (un10.low & 4294967295) >>> 0);
		q1 = go$div64(un32, vn1, false);
		rhat = (x$3 = go$mul64(q1, vn1), new Go$Uint64(un32.high - x$3.high, un32.low - x$3.low));
		/* again1: */ case 1:
		/* if ((q1.high > 1 || (q1.high === 1 && q1.low >= 0)) || (x$4 = go$mul64(q1, vn0), x$5 = (x$6 = go$mul64(new Go$Uint64(1, 0), rhat), new Go$Uint64(x$6.high + un1.high, x$6.low + un1.low)), (x$4.high > x$5.high || (x$4.high === x$5.high && x$4.low > x$5.low)))) { */ if ((q1.high > 1 || (q1.high === 1 && q1.low >= 0)) || (x$4 = go$mul64(q1, vn0), x$5 = (x$6 = go$mul64(new Go$Uint64(1, 0), rhat), new Go$Uint64(x$6.high + un1.high, x$6.low + un1.low)), (x$4.high > x$5.high || (x$4.high === x$5.high && x$4.low > x$5.low)))) {} else { go$s = 3; continue; }
			q1 = new Go$Uint64(q1.high - 0, q1.low - 1);
			rhat = (x$7 = vn1, new Go$Uint64(rhat.high + x$7.high, rhat.low + x$7.low));
			/* if ((rhat.high < 1 || (rhat.high === 1 && rhat.low < 0))) { */ if ((rhat.high < 1 || (rhat.high === 1 && rhat.low < 0))) {} else { go$s = 4; continue; }
				/* goto again1 */ go$s = 1; continue;
			/* } */ case 4:
		/* } */ case 3:
		un21 = (x$8 = (x$9 = go$mul64(un32, new Go$Uint64(1, 0)), new Go$Uint64(x$9.high + un1.high, x$9.low + un1.low)), x$10 = go$mul64(q1, v), new Go$Uint64(x$8.high - x$10.high, x$8.low - x$10.low));
		q0 = go$div64(un21, vn1, false);
		rhat = (x$11 = go$mul64(q0, vn1), new Go$Uint64(un21.high - x$11.high, un21.low - x$11.low));
		/* again2: */ case 2:
		/* if ((q0.high > 1 || (q0.high === 1 && q0.low >= 0)) || (x$12 = go$mul64(q0, vn0), x$13 = (x$14 = go$mul64(new Go$Uint64(1, 0), rhat), new Go$Uint64(x$14.high + un0.high, x$14.low + un0.low)), (x$12.high > x$13.high || (x$12.high === x$13.high && x$12.low > x$13.low)))) { */ if ((q0.high > 1 || (q0.high === 1 && q0.low >= 0)) || (x$12 = go$mul64(q0, vn0), x$13 = (x$14 = go$mul64(new Go$Uint64(1, 0), rhat), new Go$Uint64(x$14.high + un0.high, x$14.low + un0.low)), (x$12.high > x$13.high || (x$12.high === x$13.high && x$12.low > x$13.low)))) {} else { go$s = 5; continue; }
			q0 = new Go$Uint64(q0.high - 0, q0.low - 1);
			rhat = (x$15 = vn1, new Go$Uint64(rhat.high + x$15.high, rhat.low + x$15.low));
			/* if ((rhat.high < 1 || (rhat.high === 1 && rhat.low < 0))) { */ if ((rhat.high < 1 || (rhat.high === 1 && rhat.low < 0))) {} else { go$s = 6; continue; }
				/* goto again2 */ go$s = 2; continue;
			/* } */ case 6:
		/* } */ case 5:
		_tuple$1 = [(x$16 = go$mul64(q1, new Go$Uint64(1, 0)), new Go$Uint64(x$16.high + q0.high, x$16.low + q0.low)), go$shiftRightUint64(((x$17 = (x$18 = go$mul64(un21, new Go$Uint64(1, 0)), new Go$Uint64(x$18.high + un0.high, x$18.low + un0.low)), x$19 = go$mul64(q0, v), new Go$Uint64(x$17.high - x$19.high, x$17.low - x$19.low))), s)], q = _tuple$1[0], r = _tuple$1[1];
		return [q, r];
		/* */ } break; } }; return go$f();
	};
	var fadd64c = function(f, g$1, ret) {
		ret.go$set(fadd64(f, g$1));
	};
	var fsub64c = function(f, g$1, ret) {
		ret.go$set(fsub64(f, g$1));
	};
	var fmul64c = function(f, g$1, ret) {
		ret.go$set(fmul64(f, g$1));
	};
	var fdiv64c = function(f, g$1, ret) {
		ret.go$set(fdiv64(f, g$1));
	};
	var fneg64c = function(f, ret) {
		ret.go$set(fneg64(f));
	};
	var f32to64c = function(f, ret) {
		ret.go$set(f32to64(f));
	};
	var f64to32c = function(f, ret) {
		ret.go$set(f64to32(f));
	};
	var fcmp64c = function(f, g$1, ret, retnan) {
		var _tuple;
		_tuple = fcmp64(f, g$1), ret.go$set(_tuple[0]), retnan.go$set(_tuple[1]);
	};
	var fintto64c = function(val, ret) {
		ret.go$set(fintto64(val));
	};
	var f64tointc = function(f, ret, retok) {
		var _tuple;
		_tuple = f64toint(f), ret.go$set(_tuple[0]), retok.go$set(_tuple[1]);
	};
	go$pkg.init = function() {
		sizeof_C_MStats = 0;
		memStats = new MemStats.Ptr();
		precisestack = 0;
		algarray = go$makeNativeArray("Struct", 22, function() { return new alg.Ptr(); });
		startup_random_data = (go$ptrType(Go$Uint8)).nil;
		startup_random_data_len = 0;
		emptystring = "";
		zerobase = new Go$Uint64(0, 0);
		allg = (go$ptrType(g)).nil;
		lastg = (go$ptrType(g)).nil;
		allm = (go$ptrType(m)).nil;
		allp = (go$ptrType((go$ptrType(p)))).nil;
		gomaxprocs = 0;
		needextram = 0;
		panicking = 0;
		goos = (go$ptrType(Go$Int8)).nil;
		ncpu = 0;
		iscgo = 0;
		sysargs = go$throwNilPointerError;
		maxstring = new Go$Uint64(0, 0);
		hchansize = 0;
		cpuid_ecx = 0;
		cpuid_edx = 0;
		debug = new debugvars.Ptr();
		maxstacksize = new Go$Uint64(0, 0);
		blockprofilerate = new Go$Int64(0, 0);
		worldsema = 0;
		nan = 0;
		posinf = 0;
		neginf = 0;
		memstats = new mstats.Ptr();
		class_to_size = go$makeNativeArray("Int32", 61, function() { return 0; });
		class_to_allocnpages = go$makeNativeArray("Int32", 61, function() { return 0; });
		size_to_class8 = go$makeNativeArray("Int8", 129, function() { return 0; });
		size_to_class128 = go$makeNativeArray("Int8", 249, function() { return 0; });
		checking = 0;
		m0 = new m.Ptr();
		g0 = new g.Ptr();
		extram = (go$ptrType(m)).nil;
		newprocs = 0;
		scavenger = new funcval.Ptr();
		initdone = new funcval.Ptr();
		_cgo_thread_start = go$throwNilPointerError;
		prof = new _3_.Ptr();
		experiment = go$makeNativeArray("Int8", 0, function() { return 0; });
		hash = go$makeNativeArray("Ptr", 1009, function() { return (go$ptrType(itab)).nil; });
		ifacelock = new lock.Ptr();
		typelink = go$makeNativeArray("Ptr", 0, function() { return (go$ptrType(_type)).nil; });
		etypelink = go$makeNativeArray("Ptr", 0, function() { return (go$ptrType(_type)).nil; });
		empty_value = go$makeNativeArray("Uint8", 128, function() { return 0; });
		hashload = 0;

			go$throwRuntimeError = function(msg) { throw go$panic(new errorString(msg)); };
			sizeof_C_MStats = 3712;
				go$pkg.MemProfileRate = 524288;
		if (!((sizeof_C_MStats === 3712))) {
			console.log(sizeof_C_MStats, 3712);
			throw go$panic(new Go$String("MStats vs MemStatsType size mismatch"));
		}
	};
	return go$pkg;
})();
go$packages["github.com/gopherjs/gopherjs/js"] = (function() {
	var go$pkg = {};
	var Object;
	Object = go$newType(0, "Interface", "js.Object", "Object", "github.com/gopherjs/gopherjs/js", null);
	go$pkg.Object = Object;
	var Error;
	Error = go$newType(0, "Struct", "js.Error", "Error", "github.com/gopherjs/gopherjs/js", function(Object_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
	});
	Error.prototype.Bool = function() { return this.go$val.Bool(); };
	Error.Ptr.prototype.Bool = function() { return this.Object.Bool(); };
	Error.prototype.Call = function(name, args) { return this.go$val.Call(name, args); };
	Error.Ptr.prototype.Call = function(name, args) { return this.Object.Call(name, args); };
	Error.prototype.Float = function() { return this.go$val.Float(); };
	Error.Ptr.prototype.Float = function() { return this.Object.Float(); };
	Error.prototype.Get = function(name) { return this.go$val.Get(name); };
	Error.Ptr.prototype.Get = function(name) { return this.Object.Get(name); };
	Error.prototype.Index = function(i) { return this.go$val.Index(i); };
	Error.Ptr.prototype.Index = function(i) { return this.Object.Index(i); };
	Error.prototype.Int = function() { return this.go$val.Int(); };
	Error.Ptr.prototype.Int = function() { return this.Object.Int(); };
	Error.prototype.Interface = function() { return this.go$val.Interface(); };
	Error.Ptr.prototype.Interface = function() { return this.Object.Interface(); };
	Error.prototype.Invoke = function(args) { return this.go$val.Invoke(args); };
	Error.Ptr.prototype.Invoke = function(args) { return this.Object.Invoke(args); };
	Error.prototype.IsNull = function() { return this.go$val.IsNull(); };
	Error.Ptr.prototype.IsNull = function() { return this.Object.IsNull(); };
	Error.prototype.IsUndefined = function() { return this.go$val.IsUndefined(); };
	Error.Ptr.prototype.IsUndefined = function() { return this.Object.IsUndefined(); };
	Error.prototype.Length = function() { return this.go$val.Length(); };
	Error.Ptr.prototype.Length = function() { return this.Object.Length(); };
	Error.prototype.New = function(args) { return this.go$val.New(args); };
	Error.Ptr.prototype.New = function(args) { return this.Object.New(args); };
	Error.prototype.Set = function(name, value) { return this.go$val.Set(name, value); };
	Error.Ptr.prototype.Set = function(name, value) { return this.Object.Set(name, value); };
	Error.prototype.SetIndex = function(i, value) { return this.go$val.SetIndex(i, value); };
	Error.Ptr.prototype.SetIndex = function(i, value) { return this.Object.SetIndex(i, value); };
	Error.prototype.String = function() { return this.go$val.String(); };
	Error.Ptr.prototype.String = function() { return this.Object.String(); };
	go$pkg.Error = Error;
	Object.init([["Bool", "", (go$funcType([], [Go$Bool], false))], ["Call", "", (go$funcType([Go$String, (go$sliceType(go$emptyInterface))], [Object], true))], ["Float", "", (go$funcType([], [Go$Float64], false))], ["Get", "", (go$funcType([Go$String], [Object], false))], ["Index", "", (go$funcType([Go$Int], [Object], false))], ["Int", "", (go$funcType([], [Go$Int], false))], ["Interface", "", (go$funcType([], [go$emptyInterface], false))], ["Invoke", "", (go$funcType([(go$sliceType(go$emptyInterface))], [Object], true))], ["IsNull", "", (go$funcType([], [Go$Bool], false))], ["IsUndefined", "", (go$funcType([], [Go$Bool], false))], ["Length", "", (go$funcType([], [Go$Int], false))], ["New", "", (go$funcType([(go$sliceType(go$emptyInterface))], [Object], true))], ["Set", "", (go$funcType([Go$String, go$emptyInterface], [], false))], ["SetIndex", "", (go$funcType([Go$Int, go$emptyInterface], [], false))], ["String", "", (go$funcType([], [Go$String], false))]]);
	Error.init([["", "", Object, ""]]);
	Error.methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [Object], false], ["Index", "", [Go$Int], [Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	(go$ptrType(Error)).methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [Object], true], ["Error", "", [], [Go$String], false], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [Object], false], ["Index", "", [Go$Int], [Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	Error.Ptr.prototype.Error = function() {
		var err;
		err = this;
		return "JavaScript error: " + go$internalize(err.Object.message, Go$String);
	};
	Error.prototype.Error = function() { return this.go$val.Error(); };
	var Global = go$pkg.Global = function(name) {
		return null;
	};
	var This = go$pkg.This = function() {
		return null;
	};
	go$pkg.init = function() {
	};
	return go$pkg;
})();
go$packages["github.com/rusco/jquery"] = (function() {
	var go$pkg = {};
	var js = go$packages["github.com/gopherjs/gopherjs/js"];
	var JQuery;
	JQuery = go$newType(0, "Struct", "jquery.JQuery", "JQuery", "github.com/rusco/jquery", function(o_, Jquery_, Selector_, Length_, Context_) {
		this.go$val = this;
		this.o = o_ !== undefined ? o_ : null;
		this.Jquery = Jquery_ !== undefined ? Jquery_ : "";
		this.Selector = Selector_ !== undefined ? Selector_ : "";
		this.Length = Length_ !== undefined ? Length_ : "";
		this.Context = Context_ !== undefined ? Context_ : "";
	});
	go$pkg.JQuery = JQuery;
	var Event;
	Event = go$newType(0, "Struct", "jquery.Event", "Event", "github.com/rusco/jquery", function(Object_, KeyCode_, Target_, Data_, Which_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
		this.KeyCode = KeyCode_ !== undefined ? KeyCode_ : 0;
		this.Target = Target_ !== undefined ? Target_ : null;
		this.Data = Data_ !== undefined ? Data_ : null;
		this.Which = Which_ !== undefined ? Which_ : 0;
	});
	Event.prototype.Bool = function() { return this.go$val.Bool(); };
	Event.Ptr.prototype.Bool = function() { return this.Object.Bool(); };
	Event.prototype.Call = function(name, args) { return this.go$val.Call(name, args); };
	Event.Ptr.prototype.Call = function(name, args) { return this.Object.Call(name, args); };
	Event.prototype.Float = function() { return this.go$val.Float(); };
	Event.Ptr.prototype.Float = function() { return this.Object.Float(); };
	Event.prototype.Get = function(name) { return this.go$val.Get(name); };
	Event.Ptr.prototype.Get = function(name) { return this.Object.Get(name); };
	Event.prototype.Index = function(i) { return this.go$val.Index(i); };
	Event.Ptr.prototype.Index = function(i) { return this.Object.Index(i); };
	Event.prototype.Int = function() { return this.go$val.Int(); };
	Event.Ptr.prototype.Int = function() { return this.Object.Int(); };
	Event.prototype.Interface = function() { return this.go$val.Interface(); };
	Event.Ptr.prototype.Interface = function() { return this.Object.Interface(); };
	Event.prototype.Invoke = function(args) { return this.go$val.Invoke(args); };
	Event.Ptr.prototype.Invoke = function(args) { return this.Object.Invoke(args); };
	Event.prototype.IsNull = function() { return this.go$val.IsNull(); };
	Event.Ptr.prototype.IsNull = function() { return this.Object.IsNull(); };
	Event.prototype.IsUndefined = function() { return this.go$val.IsUndefined(); };
	Event.Ptr.prototype.IsUndefined = function() { return this.Object.IsUndefined(); };
	Event.prototype.Length = function() { return this.go$val.Length(); };
	Event.Ptr.prototype.Length = function() { return this.Object.Length(); };
	Event.prototype.New = function(args) { return this.go$val.New(args); };
	Event.Ptr.prototype.New = function(args) { return this.Object.New(args); };
	Event.prototype.Set = function(name, value) { return this.go$val.Set(name, value); };
	Event.Ptr.prototype.Set = function(name, value) { return this.Object.Set(name, value); };
	Event.prototype.SetIndex = function(i, value) { return this.go$val.SetIndex(i, value); };
	Event.Ptr.prototype.SetIndex = function(i, value) { return this.Object.SetIndex(i, value); };
	Event.prototype.String = function() { return this.go$val.String(); };
	Event.Ptr.prototype.String = function() { return this.Object.String(); };
	go$pkg.Event = Event;
	JQuery.init([["o", "github.com/rusco/jquery", js.Object, ""], ["Jquery", "", Go$String, "js:\"jquery\""], ["Selector", "", Go$String, "js:\"selector\""], ["Length", "", Go$String, "js:\"length\""], ["Context", "", Go$String, "js:\"context\""]]);
	JQuery.methods = [["Add", "", [Go$String], [JQuery], false], ["AddBack", "", [], [JQuery], false], ["AddBackBySelector", "", [Go$String], [JQuery], false], ["AddByContext", "", [Go$String, go$emptyInterface], [JQuery], false], ["AddClass", "", [Go$String], [JQuery], false], ["AddClassFn", "", [(go$funcType([Go$Int], [Go$String], false))], [JQuery], false], ["AddClassFnClass", "", [(go$funcType([Go$Int, Go$String], [Go$String], false))], [JQuery], false], ["AddHtml", "", [Go$String], [JQuery], false], ["AddJQuery", "", [JQuery], [JQuery], false], ["AppendTo", "", [Go$String], [JQuery], false], ["AppendToJQuery", "", [JQuery], [JQuery], false], ["Attr", "", [Go$String], [Go$String], false], ["Blur", "", [], [JQuery], false], ["ClearQueue", "", [Go$String], [JQuery], false], ["Clone", "", [], [JQuery], false], ["CloneDeep", "", [Go$Bool, Go$Bool], [JQuery], false], ["CloneWithDataAndEvents", "", [Go$Bool], [JQuery], false], ["Closest", "", [Go$String], [JQuery], false], ["Css", "", [Go$String], [Go$String], false], ["Data", "", [Go$String], [Go$String], false], ["Dequeue", "", [Go$String], [JQuery], false], ["End", "", [], [JQuery], false], ["FadeOut", "", [Go$String], [JQuery], false], ["Filter", "", [Go$String], [JQuery], false], ["FilterByFunc", "", [(go$funcType([Go$Int], [Go$Int], false))], [JQuery], false], ["FilterByJQuery", "", [JQuery], [JQuery], false], ["Find", "", [Go$String], [JQuery], false], ["FindByJQuery", "", [JQuery], [JQuery], false], ["First", "", [], [JQuery], false], ["Focus", "", [], [JQuery], false], ["Has", "", [Go$String], [JQuery], false], ["Height", "", [], [Go$Int], false], ["Hide", "", [], [JQuery], false], ["Html", "", [], [Go$String], false], ["HtmlByFunc", "", [(go$funcType([Go$Int, Go$String], [Go$String], false))], [JQuery], false], ["Is", "", [Go$String], [Go$Bool], false], ["IsByFunc", "", [(go$funcType([Go$Int], [Go$Bool], false))], [JQuery], false], ["IsByJQuery", "", [JQuery], [Go$Bool], false], ["Last", "", [], [JQuery], false], ["Next", "", [], [JQuery], false], ["NextAll", "", [], [JQuery], false], ["NextAllBySelector", "", [Go$String], [JQuery], false], ["NextBySelector", "", [Go$String], [JQuery], false], ["NextUntil", "", [Go$String], [JQuery], false], ["NextUntilByFilter", "", [Go$String, Go$String], [JQuery], false], ["NextUntilByJQuery", "", [JQuery], [JQuery], false], ["NextUntilByJQueryAndFilter", "", [JQuery, Go$String], [JQuery], false], ["Not", "", [Go$String], [JQuery], false], ["NotByJQuery", "", [JQuery], [JQuery], false], ["Off", "", [Go$String, (go$funcType([Event], [], false))], [JQuery], false], ["OffsetParent", "", [], [JQuery], false], ["On", "", [Go$String, (go$funcType([Event], [], false))], [JQuery], false], ["OnParam", "", [Go$String, go$emptyInterface], [JQuery], false], ["OnSelector", "", [Go$String, Go$String, (go$funcType([Event], [], false))], [JQuery], false], ["One", "", [Go$String, (go$funcType([Event], [], false))], [JQuery], false], ["Parent", "", [], [JQuery], false], ["ParentBySelector", "", [Go$String], [JQuery], false], ["Parents", "", [], [JQuery], false], ["ParentsBySelector", "", [Go$String], [JQuery], false], ["ParentsUntil", "", [Go$String], [JQuery], false], ["ParentsUntilByFilter", "", [Go$String, Go$String], [JQuery], false], ["ParentsUntilByJQuery", "", [JQuery], [JQuery], false], ["ParentsUntilByJQueryAndFilter", "", [JQuery, Go$String], [JQuery], false], ["Prev", "", [], [JQuery], false], ["PrevAll", "", [], [JQuery], false], ["PrevAllBySelector", "", [Go$String], [JQuery], false], ["PrevBySelector", "", [Go$String], [JQuery], false], ["PrevUntil", "", [Go$String], [JQuery], false], ["PrevUntilByFilter", "", [Go$String, Go$String], [JQuery], false], ["PrevUntilByJQuery", "", [JQuery], [JQuery], false], ["PrevUntilByJQueryAndFilter", "", [JQuery, Go$String], [JQuery], false], ["Prop", "", [Go$String], [Go$Bool], false], ["Ready", "", [(go$funcType([], [], false))], [JQuery], false], ["RemoveClass", "", [Go$String], [JQuery], false], ["RemoveData", "", [Go$String], [JQuery], false], ["Resize", "", [], [JQuery], false], ["ResizeDataFn", "", [js.Object, (go$funcType([js.Object], [js.Object], false))], [JQuery], false], ["ResizeFn", "", [(go$funcType([js.Object], [js.Object], false))], [JQuery], false], ["Scroll", "", [], [JQuery], false], ["ScrollDataFn", "", [js.Object, (go$funcType([js.Object], [js.Object], false))], [JQuery], false], ["ScrollFn", "", [(go$funcType([], [], false))], [JQuery], false], ["ScrollLeft", "", [], [Go$Int], false], ["ScrollTop", "", [], [Go$Int], false], ["Select", "", [], [JQuery], false], ["SelectDataFn", "", [js.Object, (go$funcType([js.Object], [js.Object], false))], [JQuery], false], ["SelectFn", "", [(go$funcType([], [], false))], [JQuery], false], ["Serialize", "", [], [Go$String], false], ["SetCss", "", [go$emptyInterface, go$emptyInterface], [JQuery], false], ["SetData", "", [Go$String, Go$String], [JQuery], false], ["SetHeight", "", [Go$String], [JQuery], false], ["SetHtml", "", [Go$String], [JQuery], false], ["SetProp", "", [Go$String, Go$Bool], [JQuery], false], ["SetScrollLeft", "", [Go$Int], [JQuery], false], ["SetScrollTop", "", [Go$Int], [JQuery], false], ["SetText", "", [Go$String], [JQuery], false], ["SetVal", "", [Go$String], [JQuery], false], ["SetWidth", "", [Go$String], [JQuery], false], ["Show", "", [], [JQuery], false], ["Siblings", "", [], [JQuery], false], ["SiblingsBySelector", "", [Go$String], [JQuery], false], ["Slice", "", [Go$Int], [JQuery], false], ["SliceByEnd", "", [Go$Int, Go$Int], [JQuery], false], ["Submit", "", [], [JQuery], false], ["SubmitDataFn", "", [js.Object, (go$funcType([Event], [], false))], [JQuery], false], ["SubmitFn", "", [(go$funcType([], [], false))], [JQuery], false], ["Text", "", [], [Go$String], false], ["TextByFunc", "", [(go$funcType([Go$Int, Go$String], [Go$String], false))], [JQuery], false], ["Toggle", "", [Go$Bool], [JQuery], false], ["ToggleClass", "", [Go$Bool], [JQuery], false], ["ToggleClassByName", "", [Go$String, Go$Bool], [JQuery], false], ["Trigger", "", [Go$String], [JQuery], false], ["TriggerHandler", "", [Go$String, go$emptyInterface], [JQuery], false], ["TriggerParam", "", [Go$String, go$emptyInterface], [JQuery], false], ["Unbind", "", [], [JQuery], false], ["UnbindEvent", "", [js.Object], [JQuery], false], ["UnbindFn", "", [js.Object, (go$funcType([js.Object], [js.Object], false))], [JQuery], false], ["Undelegate", "", [], [JQuery], false], ["UndelegateEvent", "", [js.Object], [JQuery], false], ["UndelegateFn", "", [js.Object, (go$funcType([js.Object], [js.Object], false))], [JQuery], false], ["UndelegateNamespace", "", [Go$String], [JQuery], false], ["Unload", "", [(go$funcType([Event], [js.Object], false))], [JQuery], false], ["UnloadEventdata", "", [js.Object, (go$funcType([Event], [js.Object], false))], [JQuery], false], ["Val", "", [], [Go$String], false], ["Width", "", [], [Go$Int], false], ["WidthByFunc", "", [(go$funcType([Go$Int, Go$String], [Go$String], false))], [JQuery], false]];
	(go$ptrType(JQuery)).methods = [["Add", "", [Go$String], [JQuery], false], ["AddBack", "", [], [JQuery], false], ["AddBackBySelector", "", [Go$String], [JQuery], false], ["AddByContext", "", [Go$String, go$emptyInterface], [JQuery], false], ["AddClass", "", [Go$String], [JQuery], false], ["AddClassFn", "", [(go$funcType([Go$Int], [Go$String], false))], [JQuery], false], ["AddClassFnClass", "", [(go$funcType([Go$Int, Go$String], [Go$String], false))], [JQuery], false], ["AddHtml", "", [Go$String], [JQuery], false], ["AddJQuery", "", [JQuery], [JQuery], false], ["AppendTo", "", [Go$String], [JQuery], false], ["AppendToJQuery", "", [JQuery], [JQuery], false], ["Attr", "", [Go$String], [Go$String], false], ["Blur", "", [], [JQuery], false], ["ClearQueue", "", [Go$String], [JQuery], false], ["Clone", "", [], [JQuery], false], ["CloneDeep", "", [Go$Bool, Go$Bool], [JQuery], false], ["CloneWithDataAndEvents", "", [Go$Bool], [JQuery], false], ["Closest", "", [Go$String], [JQuery], false], ["Css", "", [Go$String], [Go$String], false], ["Data", "", [Go$String], [Go$String], false], ["Dequeue", "", [Go$String], [JQuery], false], ["End", "", [], [JQuery], false], ["FadeOut", "", [Go$String], [JQuery], false], ["Filter", "", [Go$String], [JQuery], false], ["FilterByFunc", "", [(go$funcType([Go$Int], [Go$Int], false))], [JQuery], false], ["FilterByJQuery", "", [JQuery], [JQuery], false], ["Find", "", [Go$String], [JQuery], false], ["FindByJQuery", "", [JQuery], [JQuery], false], ["First", "", [], [JQuery], false], ["Focus", "", [], [JQuery], false], ["Has", "", [Go$String], [JQuery], false], ["Height", "", [], [Go$Int], false], ["Hide", "", [], [JQuery], false], ["Html", "", [], [Go$String], false], ["HtmlByFunc", "", [(go$funcType([Go$Int, Go$String], [Go$String], false))], [JQuery], false], ["Is", "", [Go$String], [Go$Bool], false], ["IsByFunc", "", [(go$funcType([Go$Int], [Go$Bool], false))], [JQuery], false], ["IsByJQuery", "", [JQuery], [Go$Bool], false], ["Last", "", [], [JQuery], false], ["Next", "", [], [JQuery], false], ["NextAll", "", [], [JQuery], false], ["NextAllBySelector", "", [Go$String], [JQuery], false], ["NextBySelector", "", [Go$String], [JQuery], false], ["NextUntil", "", [Go$String], [JQuery], false], ["NextUntilByFilter", "", [Go$String, Go$String], [JQuery], false], ["NextUntilByJQuery", "", [JQuery], [JQuery], false], ["NextUntilByJQueryAndFilter", "", [JQuery, Go$String], [JQuery], false], ["Not", "", [Go$String], [JQuery], false], ["NotByJQuery", "", [JQuery], [JQuery], false], ["Off", "", [Go$String, (go$funcType([Event], [], false))], [JQuery], false], ["OffsetParent", "", [], [JQuery], false], ["On", "", [Go$String, (go$funcType([Event], [], false))], [JQuery], false], ["OnParam", "", [Go$String, go$emptyInterface], [JQuery], false], ["OnSelector", "", [Go$String, Go$String, (go$funcType([Event], [], false))], [JQuery], false], ["One", "", [Go$String, (go$funcType([Event], [], false))], [JQuery], false], ["Parent", "", [], [JQuery], false], ["ParentBySelector", "", [Go$String], [JQuery], false], ["Parents", "", [], [JQuery], false], ["ParentsBySelector", "", [Go$String], [JQuery], false], ["ParentsUntil", "", [Go$String], [JQuery], false], ["ParentsUntilByFilter", "", [Go$String, Go$String], [JQuery], false], ["ParentsUntilByJQuery", "", [JQuery], [JQuery], false], ["ParentsUntilByJQueryAndFilter", "", [JQuery, Go$String], [JQuery], false], ["Prev", "", [], [JQuery], false], ["PrevAll", "", [], [JQuery], false], ["PrevAllBySelector", "", [Go$String], [JQuery], false], ["PrevBySelector", "", [Go$String], [JQuery], false], ["PrevUntil", "", [Go$String], [JQuery], false], ["PrevUntilByFilter", "", [Go$String, Go$String], [JQuery], false], ["PrevUntilByJQuery", "", [JQuery], [JQuery], false], ["PrevUntilByJQueryAndFilter", "", [JQuery, Go$String], [JQuery], false], ["Prop", "", [Go$String], [Go$Bool], false], ["Ready", "", [(go$funcType([], [], false))], [JQuery], false], ["RemoveClass", "", [Go$String], [JQuery], false], ["RemoveData", "", [Go$String], [JQuery], false], ["Resize", "", [], [JQuery], false], ["ResizeDataFn", "", [js.Object, (go$funcType([js.Object], [js.Object], false))], [JQuery], false], ["ResizeFn", "", [(go$funcType([js.Object], [js.Object], false))], [JQuery], false], ["Scroll", "", [], [JQuery], false], ["ScrollDataFn", "", [js.Object, (go$funcType([js.Object], [js.Object], false))], [JQuery], false], ["ScrollFn", "", [(go$funcType([], [], false))], [JQuery], false], ["ScrollLeft", "", [], [Go$Int], false], ["ScrollTop", "", [], [Go$Int], false], ["Select", "", [], [JQuery], false], ["SelectDataFn", "", [js.Object, (go$funcType([js.Object], [js.Object], false))], [JQuery], false], ["SelectFn", "", [(go$funcType([], [], false))], [JQuery], false], ["Serialize", "", [], [Go$String], false], ["SetCss", "", [go$emptyInterface, go$emptyInterface], [JQuery], false], ["SetData", "", [Go$String, Go$String], [JQuery], false], ["SetHeight", "", [Go$String], [JQuery], false], ["SetHtml", "", [Go$String], [JQuery], false], ["SetProp", "", [Go$String, Go$Bool], [JQuery], false], ["SetScrollLeft", "", [Go$Int], [JQuery], false], ["SetScrollTop", "", [Go$Int], [JQuery], false], ["SetText", "", [Go$String], [JQuery], false], ["SetVal", "", [Go$String], [JQuery], false], ["SetWidth", "", [Go$String], [JQuery], false], ["Show", "", [], [JQuery], false], ["Siblings", "", [], [JQuery], false], ["SiblingsBySelector", "", [Go$String], [JQuery], false], ["Slice", "", [Go$Int], [JQuery], false], ["SliceByEnd", "", [Go$Int, Go$Int], [JQuery], false], ["Submit", "", [], [JQuery], false], ["SubmitDataFn", "", [js.Object, (go$funcType([Event], [], false))], [JQuery], false], ["SubmitFn", "", [(go$funcType([], [], false))], [JQuery], false], ["Text", "", [], [Go$String], false], ["TextByFunc", "", [(go$funcType([Go$Int, Go$String], [Go$String], false))], [JQuery], false], ["Toggle", "", [Go$Bool], [JQuery], false], ["ToggleClass", "", [Go$Bool], [JQuery], false], ["ToggleClassByName", "", [Go$String, Go$Bool], [JQuery], false], ["Trigger", "", [Go$String], [JQuery], false], ["TriggerHandler", "", [Go$String, go$emptyInterface], [JQuery], false], ["TriggerParam", "", [Go$String, go$emptyInterface], [JQuery], false], ["Unbind", "", [], [JQuery], false], ["UnbindEvent", "", [js.Object], [JQuery], false], ["UnbindFn", "", [js.Object, (go$funcType([js.Object], [js.Object], false))], [JQuery], false], ["Undelegate", "", [], [JQuery], false], ["UndelegateEvent", "", [js.Object], [JQuery], false], ["UndelegateFn", "", [js.Object, (go$funcType([js.Object], [js.Object], false))], [JQuery], false], ["UndelegateNamespace", "", [Go$String], [JQuery], false], ["Unload", "", [(go$funcType([Event], [js.Object], false))], [JQuery], false], ["UnloadEventdata", "", [js.Object, (go$funcType([Event], [js.Object], false))], [JQuery], false], ["Val", "", [], [Go$String], false], ["Width", "", [], [Go$Int], false], ["WidthByFunc", "", [(go$funcType([Go$Int, Go$String], [Go$String], false))], [JQuery], false]];
	Event.init([["", "", js.Object, ""], ["KeyCode", "", Go$Int, "js:\"keyCode\""], ["Target", "", js.Object, "js:\"target\""], ["Data", "", go$emptyInterface, "js:\"data\""], ["Which", "", Go$Int, "js:\"which\""]]);
	Event.methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	(go$ptrType(Event)).methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["PreventDefault", "", [], [], false], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	Event.Ptr.prototype.PreventDefault = function() {
		var event;
		event = this;
		event.Object.preventDefault();
	};
	Event.prototype.PreventDefault = function() { return this.go$val.PreventDefault(); };
	var NewJQuery = go$pkg.NewJQuery = function(args) {
		var _slice, _index, jQ, _slice$1, _index$1, _slice$2, _index$2, jQ$1;
		if (args.length === 1) {
			jQ = new go$global.jQuery(go$externalize((_slice = args, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")), go$emptyInterface));
			return new JQuery.Ptr(jQ, "", "", "", "");
		} else if (args.length === 2) {
			jQ$1 = new go$global.jQuery(go$externalize((_slice$1 = args, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")), go$emptyInterface), go$externalize((_slice$2 = args, _index$2 = 1, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")), go$emptyInterface));
			return new JQuery.Ptr(jQ$1, "", "", "", "");
		}
		return new JQuery.Ptr(new go$global.jQuery(), "", "", "", "");
	};
	var Trim = go$pkg.Trim = function(text) {
		return go$internalize(go$global.jQuery.trim(go$externalize(text, Go$String)), Go$String);
	};
	var GlobalEval = go$pkg.GlobalEval = function(cmd) {
		go$global.jQuery.globalEval(go$externalize(cmd, Go$String));
	};
	var Type = go$pkg.Type = function(sth) {
		return go$internalize(go$global.jQuery.type(go$externalize(sth, go$emptyInterface)), Go$String);
	};
	var IsPlainObject = go$pkg.IsPlainObject = function(sth) {
		return !!(go$global.jQuery.isPlainObject(go$externalize(sth, go$emptyInterface)));
	};
	var IsFunction = go$pkg.IsFunction = function(sth) {
		return !!(go$global.jQuery.isFunction(go$externalize(sth, go$emptyInterface)));
	};
	var IsNumeric = go$pkg.IsNumeric = function(sth) {
		return !!(go$global.jQuery.isNumeric(go$externalize(sth, go$emptyInterface)));
	};
	var IsXMLDoc = go$pkg.IsXMLDoc = function(sth) {
		return !!(go$global.jQuery.isXMLDoc(go$externalize(sth, go$emptyInterface)));
	};
	var IsWindow = go$pkg.IsWindow = function(sth) {
		return !!(go$global.jQuery.isWindow(go$externalize(sth, go$emptyInterface)));
	};
	JQuery.Ptr.prototype.Serialize = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$internalize(j.o.serialize(), Go$String);
	};
	JQuery.prototype.Serialize = function() { return this.go$val.Serialize(); };
	JQuery.Ptr.prototype.AddBack = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.addBack();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.AddBack = function() { return this.go$val.AddBack(); };
	JQuery.Ptr.prototype.AddBackBySelector = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.addBack(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.AddBackBySelector = function(selector) { return this.go$val.AddBackBySelector(selector); };
	JQuery.Ptr.prototype.Css = function(name) {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$internalize(j.o.css(go$externalize(name, Go$String)), Go$String);
	};
	JQuery.prototype.Css = function(name) { return this.go$val.Css(name); };
	JQuery.Ptr.prototype.SetCss = function(name, value) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.css(go$externalize(name, go$emptyInterface), go$externalize(value, go$emptyInterface));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetCss = function(name, value) { return this.go$val.SetCss(name, value); };
	JQuery.Ptr.prototype.Text = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$internalize(j.o.text(), Go$String);
	};
	JQuery.prototype.Text = function() { return this.go$val.Text(); };
	JQuery.Ptr.prototype.SetText = function(name) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.text(go$externalize(name, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetText = function(name) { return this.go$val.SetText(name); };
	JQuery.Ptr.prototype.Val = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$internalize(j.o.val(), Go$String);
	};
	JQuery.prototype.Val = function() { return this.go$val.Val(); };
	JQuery.Ptr.prototype.SetVal = function(name) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.val(go$externalize(name, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetVal = function(name) { return this.go$val.SetVal(name); };
	JQuery.Ptr.prototype.Prop = function(property) {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return !!(j.o.prop(go$externalize(property, Go$String)));
	};
	JQuery.prototype.Prop = function(property) { return this.go$val.Prop(property); };
	JQuery.Ptr.prototype.SetProp = function(name, value) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.prop(go$externalize(name, Go$String), go$externalize(value, Go$Bool));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetProp = function(name, value) { return this.go$val.SetProp(name, value); };
	JQuery.Ptr.prototype.Attr = function(property) {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$internalize(j.o.attr(go$externalize(property, Go$String)), Go$String);
	};
	JQuery.prototype.Attr = function(property) { return this.go$val.Attr(property); };
	JQuery.Ptr.prototype.AddClass = function(property) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.addClass(go$externalize(property, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.AddClass = function(property) { return this.go$val.AddClass(property); };
	JQuery.Ptr.prototype.AddClassFn = function(fn) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.html(go$externalize((function(idx) {
			return fn(idx);
		}), (go$funcType([Go$Int], [Go$String], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.AddClassFn = function(fn) { return this.go$val.AddClassFn(fn); };
	JQuery.Ptr.prototype.AddClassFnClass = function(fn) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.html(go$externalize((function(idx, class$1) {
			return fn(idx, class$1);
		}), (go$funcType([Go$Int, Go$String], [Go$String], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.AddClassFnClass = function(fn) { return this.go$val.AddClassFnClass(fn); };
	JQuery.Ptr.prototype.RemoveClass = function(property) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.removeClass(go$externalize(property, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.RemoveClass = function(property) { return this.go$val.RemoveClass(property); };
	JQuery.Ptr.prototype.ToggleClassByName = function(className, swtch) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.toggleClass(go$externalize(className, Go$String), go$externalize(swtch, Go$Bool));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.ToggleClassByName = function(className, swtch) { return this.go$val.ToggleClassByName(className, swtch); };
	JQuery.Ptr.prototype.ToggleClass = function(swtch) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.toggleClass(go$externalize(swtch, Go$Bool));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.ToggleClass = function(swtch) { return this.go$val.ToggleClass(swtch); };
	JQuery.Ptr.prototype.Focus = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.focus();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Focus = function() { return this.go$val.Focus(); };
	JQuery.Ptr.prototype.Blur = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.blur();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Blur = function() { return this.go$val.Blur(); };
	JQuery.Ptr.prototype.On = function(event, handler) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.on(go$externalize(event, Go$String), go$externalize((function(e) {
			handler(new Event.Ptr(e, 0, null, null, 0));
		}), (go$funcType([js.Object], [], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.On = function(event, handler) { return this.go$val.On(event, handler); };
	JQuery.Ptr.prototype.OnParam = function(event, param) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.on(go$externalize(event, Go$String), go$externalize(param, go$emptyInterface));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.OnParam = function(event, param) { return this.go$val.OnParam(event, param); };
	JQuery.Ptr.prototype.OnSelector = function(event, selector, handler) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.on(go$externalize(event, Go$String), go$externalize(selector, Go$String), go$externalize((function(e) {
			handler(new Event.Ptr(e, 0, null, null, 0));
		}), (go$funcType([js.Object], [], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.OnSelector = function(event, selector, handler) { return this.go$val.OnSelector(event, selector, handler); };
	JQuery.Ptr.prototype.One = function(event, handler) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.one(go$externalize(event, Go$String), go$externalize((function(e) {
			handler(new Event.Ptr(e, 0, null, null, 0));
		}), (go$funcType([js.Object], [], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.One = function(event, handler) { return this.go$val.One(event, handler); };
	JQuery.Ptr.prototype.Off = function(event, handler) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.off(go$externalize(event, Go$String), go$externalize((function(e) {
			handler(new Event.Ptr(e, 0, null, null, 0));
		}), (go$funcType([js.Object], [], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Off = function(event, handler) { return this.go$val.Off(event, handler); };
	JQuery.Ptr.prototype.AppendTo = function(destination) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.appendTo(go$externalize(destination, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.AppendTo = function(destination) { return this.go$val.AppendTo(destination); };
	JQuery.Ptr.prototype.AppendToJQuery = function(obj) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.appendTo(obj.o);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.AppendToJQuery = function(obj) { return this.go$val.AppendToJQuery(obj); };
	JQuery.Ptr.prototype.Toggle = function(showOrHide) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.toggle(go$externalize(showOrHide, Go$Bool));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Toggle = function(showOrHide) { return this.go$val.Toggle(showOrHide); };
	JQuery.Ptr.prototype.Show = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.show();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Show = function() { return this.go$val.Show(); };
	JQuery.Ptr.prototype.Hide = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.hide();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Hide = function() { return this.go$val.Hide(); };
	JQuery.Ptr.prototype.Html = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$internalize(j.o.html(), Go$String);
	};
	JQuery.prototype.Html = function() { return this.go$val.Html(); };
	JQuery.Ptr.prototype.SetHtml = function(html) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.html(go$externalize(html, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetHtml = function(html) { return this.go$val.SetHtml(html); };
	JQuery.Ptr.prototype.HtmlByFunc = function(fn) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.html(go$externalize((function(idx, txt) {
			return fn(idx, txt);
		}), (go$funcType([Go$Int, Go$String], [Go$String], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.HtmlByFunc = function(fn) { return this.go$val.HtmlByFunc(fn); };
	JQuery.Ptr.prototype.TextByFunc = function(fn) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.text(go$externalize((function(idx, txt) {
			return fn(idx, txt);
		}), (go$funcType([Go$Int, Go$String], [Go$String], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.TextByFunc = function(fn) { return this.go$val.TextByFunc(fn); };
	JQuery.Ptr.prototype.Closest = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.closest(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Closest = function(selector) { return this.go$val.Closest(selector); };
	JQuery.Ptr.prototype.End = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.end();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.End = function() { return this.go$val.End(); };
	JQuery.Ptr.prototype.Add = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.add(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Add = function(selector) { return this.go$val.Add(selector); };
	JQuery.Ptr.prototype.AddByContext = function(selector, context) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.add(go$externalize(selector, Go$String), go$externalize(context, go$emptyInterface));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.AddByContext = function(selector, context) { return this.go$val.AddByContext(selector, context); };
	JQuery.Ptr.prototype.AddHtml = function(html) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.add(go$externalize(html, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.AddHtml = function(html) { return this.go$val.AddHtml(html); };
	JQuery.Ptr.prototype.AddJQuery = function(obj) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.add(obj.o);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.AddJQuery = function(obj) { return this.go$val.AddJQuery(obj); };
	JQuery.Ptr.prototype.Clone = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.clone();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Clone = function() { return this.go$val.Clone(); };
	JQuery.Ptr.prototype.CloneWithDataAndEvents = function(withDataAndEvents) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.clone(go$externalize(withDataAndEvents, Go$Bool));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.CloneWithDataAndEvents = function(withDataAndEvents) { return this.go$val.CloneWithDataAndEvents(withDataAndEvents); };
	JQuery.Ptr.prototype.CloneDeep = function(withDataAndEvents, deepWithDataAndEvents) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.clone(go$externalize(withDataAndEvents, Go$Bool), go$externalize(deepWithDataAndEvents, Go$Bool));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.CloneDeep = function(withDataAndEvents, deepWithDataAndEvents) { return this.go$val.CloneDeep(withDataAndEvents, deepWithDataAndEvents); };
	JQuery.Ptr.prototype.Height = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$parseInt(j.o.height()) >> 0;
	};
	JQuery.prototype.Height = function() { return this.go$val.Height(); };
	JQuery.Ptr.prototype.SetHeight = function(value) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.height(go$externalize(value, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetHeight = function(value) { return this.go$val.SetHeight(value); };
	JQuery.Ptr.prototype.ScrollLeft = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$parseInt(j.o.scrollLeft()) >> 0;
	};
	JQuery.prototype.ScrollLeft = function() { return this.go$val.ScrollLeft(); };
	JQuery.Ptr.prototype.SetScrollLeft = function(value) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.scrollLeft(value);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetScrollLeft = function(value) { return this.go$val.SetScrollLeft(value); };
	JQuery.Ptr.prototype.ScrollTop = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$parseInt(j.o.scrollTop()) >> 0;
	};
	JQuery.prototype.ScrollTop = function() { return this.go$val.ScrollTop(); };
	JQuery.Ptr.prototype.SetScrollTop = function(value) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.scrollTop(value);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetScrollTop = function(value) { return this.go$val.SetScrollTop(value); };
	JQuery.Ptr.prototype.Width = function() {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$parseInt(j.o.scrollTop()) >> 0;
	};
	JQuery.prototype.Width = function() { return this.go$val.Width(); };
	JQuery.Ptr.prototype.SetWidth = function(value) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.scrollTop(go$externalize(value, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetWidth = function(value) { return this.go$val.SetWidth(value); };
	JQuery.Ptr.prototype.WidthByFunc = function(fn) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.width(go$externalize((function(index, width) {
			return fn(index, width);
		}), (go$funcType([Go$Int, Go$String], [Go$String], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.WidthByFunc = function(fn) { return this.go$val.WidthByFunc(fn); };
	JQuery.Ptr.prototype.ClearQueue = function(queueName) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.clearQueue(go$externalize(queueName, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.ClearQueue = function(queueName) { return this.go$val.ClearQueue(queueName); };
	JQuery.Ptr.prototype.SetData = function(key, value) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.data(go$externalize(key, Go$String), go$externalize(value, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SetData = function(key, value) { return this.go$val.SetData(key, value); };
	JQuery.Ptr.prototype.Data = function(key) {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return go$internalize(j.o.data(go$externalize(key, Go$String)), Go$String);
	};
	JQuery.prototype.Data = function(key) { return this.go$val.Data(key); };
	JQuery.Ptr.prototype.Dequeue = function(queueName) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.dequeue(go$externalize(queueName, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Dequeue = function(queueName) { return this.go$val.Dequeue(queueName); };
	JQuery.Ptr.prototype.RemoveData = function(name) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.removeData(go$externalize(name, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.RemoveData = function(name) { return this.go$val.RemoveData(name); };
	JQuery.Ptr.prototype.OffsetParent = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.offsetParent();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.OffsetParent = function() { return this.go$val.OffsetParent(); };
	JQuery.Ptr.prototype.Parent = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.parent();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Parent = function() { return this.go$val.Parent(); };
	JQuery.Ptr.prototype.ParentBySelector = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.parent(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.ParentBySelector = function(selector) { return this.go$val.ParentBySelector(selector); };
	JQuery.Ptr.prototype.Parents = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.parents();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Parents = function() { return this.go$val.Parents(); };
	JQuery.Ptr.prototype.ParentsBySelector = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.parents(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.ParentsBySelector = function(selector) { return this.go$val.ParentsBySelector(selector); };
	JQuery.Ptr.prototype.ParentsUntil = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.parentsUntil(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.ParentsUntil = function(selector) { return this.go$val.ParentsUntil(selector); };
	JQuery.Ptr.prototype.ParentsUntilByFilter = function(selector, filter) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.parentsUntil(go$externalize(selector, Go$String), go$externalize(filter, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.ParentsUntilByFilter = function(selector, filter) { return this.go$val.ParentsUntilByFilter(selector, filter); };
	JQuery.Ptr.prototype.ParentsUntilByJQuery = function(obj) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.parentsUntil(obj.o);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.ParentsUntilByJQuery = function(obj) { return this.go$val.ParentsUntilByJQuery(obj); };
	JQuery.Ptr.prototype.ParentsUntilByJQueryAndFilter = function(obj, filter) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.parentsUntil(obj.o, go$externalize(filter, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.ParentsUntilByJQueryAndFilter = function(obj, filter) { return this.go$val.ParentsUntilByJQueryAndFilter(obj, filter); };
	JQuery.Ptr.prototype.Prev = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.prev();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Prev = function() { return this.go$val.Prev(); };
	JQuery.Ptr.prototype.PrevBySelector = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.prev(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.PrevBySelector = function(selector) { return this.go$val.PrevBySelector(selector); };
	JQuery.Ptr.prototype.PrevAll = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.prevAll();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.PrevAll = function() { return this.go$val.PrevAll(); };
	JQuery.Ptr.prototype.PrevAllBySelector = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.prevAll(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.PrevAllBySelector = function(selector) { return this.go$val.PrevAllBySelector(selector); };
	JQuery.Ptr.prototype.PrevUntil = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.prevUntil(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.PrevUntil = function(selector) { return this.go$val.PrevUntil(selector); };
	JQuery.Ptr.prototype.PrevUntilByFilter = function(selector, filter) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.prevUntil(go$externalize(selector, Go$String), go$externalize(filter, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.PrevUntilByFilter = function(selector, filter) { return this.go$val.PrevUntilByFilter(selector, filter); };
	JQuery.Ptr.prototype.PrevUntilByJQuery = function(obj) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.prevUntil(obj.o);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.PrevUntilByJQuery = function(obj) { return this.go$val.PrevUntilByJQuery(obj); };
	JQuery.Ptr.prototype.PrevUntilByJQueryAndFilter = function(obj, filter) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.prevUntil(obj.o, go$externalize(filter, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.PrevUntilByJQueryAndFilter = function(obj, filter) { return this.go$val.PrevUntilByJQueryAndFilter(obj, filter); };
	JQuery.Ptr.prototype.Siblings = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.siblings();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Siblings = function() { return this.go$val.Siblings(); };
	JQuery.Ptr.prototype.SiblingsBySelector = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.siblings(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SiblingsBySelector = function(selector) { return this.go$val.SiblingsBySelector(selector); };
	JQuery.Ptr.prototype.Slice = function(start) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.slice(start);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Slice = function(start) { return this.go$val.Slice(start); };
	JQuery.Ptr.prototype.SliceByEnd = function(start, end) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.slice(start, end);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SliceByEnd = function(start, end) { return this.go$val.SliceByEnd(start, end); };
	JQuery.Ptr.prototype.Next = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.next();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Next = function() { return this.go$val.Next(); };
	JQuery.Ptr.prototype.NextBySelector = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.next(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.NextBySelector = function(selector) { return this.go$val.NextBySelector(selector); };
	JQuery.Ptr.prototype.NextAll = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.nextAll();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.NextAll = function() { return this.go$val.NextAll(); };
	JQuery.Ptr.prototype.NextAllBySelector = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.nextAll(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.NextAllBySelector = function(selector) { return this.go$val.NextAllBySelector(selector); };
	JQuery.Ptr.prototype.NextUntil = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.nextUntil(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.NextUntil = function(selector) { return this.go$val.NextUntil(selector); };
	JQuery.Ptr.prototype.NextUntilByFilter = function(selector, filter) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.nextUntil(go$externalize(selector, Go$String), go$externalize(filter, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.NextUntilByFilter = function(selector, filter) { return this.go$val.NextUntilByFilter(selector, filter); };
	JQuery.Ptr.prototype.NextUntilByJQuery = function(obj) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.nextUntil(obj.o);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.NextUntilByJQuery = function(obj) { return this.go$val.NextUntilByJQuery(obj); };
	JQuery.Ptr.prototype.NextUntilByJQueryAndFilter = function(obj, filter) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.nextUntil(obj.o, go$externalize(filter, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.NextUntilByJQueryAndFilter = function(obj, filter) { return this.go$val.NextUntilByJQueryAndFilter(obj, filter); };
	JQuery.Ptr.prototype.Not = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.not(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Not = function(selector) { return this.go$val.Not(selector); };
	JQuery.Ptr.prototype.NotByJQuery = function(obj) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.not(obj.o);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.NotByJQuery = function(obj) { return this.go$val.NotByJQuery(obj); };
	JQuery.Ptr.prototype.Filter = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.filter(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Filter = function(selector) { return this.go$val.Filter(selector); };
	JQuery.Ptr.prototype.FilterByFunc = function(fn) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.filter(go$externalize((function(index) {
			return fn(index);
		}), (go$funcType([Go$Int], [Go$Int], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.FilterByFunc = function(fn) { return this.go$val.FilterByFunc(fn); };
	JQuery.Ptr.prototype.FilterByJQuery = function(obj) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.filter(obj.o);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.FilterByJQuery = function(obj) { return this.go$val.FilterByJQuery(obj); };
	JQuery.Ptr.prototype.Find = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.find(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Find = function(selector) { return this.go$val.Find(selector); };
	JQuery.Ptr.prototype.FindByJQuery = function(obj) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.find(obj.o);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.FindByJQuery = function(obj) { return this.go$val.FindByJQuery(obj); };
	JQuery.Ptr.prototype.First = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.first();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.First = function() { return this.go$val.First(); };
	JQuery.Ptr.prototype.Has = function(selector) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.has(go$externalize(selector, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Has = function(selector) { return this.go$val.Has(selector); };
	JQuery.Ptr.prototype.Is = function(selector) {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return !!(j.o.Is(go$externalize(selector, Go$String)));
	};
	JQuery.prototype.Is = function(selector) { return this.go$val.Is(selector); };
	JQuery.Ptr.prototype.IsByFunc = function(fn) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.width(go$externalize((function(index) {
			return fn(index);
		}), (go$funcType([Go$Int], [Go$Bool], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.IsByFunc = function(fn) { return this.go$val.IsByFunc(fn); };
	JQuery.Ptr.prototype.IsByJQuery = function(obj) {
		var _struct, j;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		return !!(j.o.is(obj.o));
	};
	JQuery.prototype.IsByJQuery = function(obj) { return this.go$val.IsByJQuery(obj); };
	JQuery.Ptr.prototype.Last = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.Last();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Last = function() { return this.go$val.Last(); };
	JQuery.Ptr.prototype.Ready = function(handler) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.ready(go$externalize(handler, (go$funcType([], [], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Ready = function(handler) { return this.go$val.Ready(handler); };
	JQuery.Ptr.prototype.Resize = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.resize();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Resize = function() { return this.go$val.Resize(); };
	JQuery.Ptr.prototype.ResizeFn = function(handler) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.resize(go$externalize((function(ev) {
			return handler(ev);
		}), (go$funcType([js.Object], [js.Object], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.ResizeFn = function(handler) { return this.go$val.ResizeFn(handler); };
	JQuery.Ptr.prototype.ResizeDataFn = function(eventData, handler) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.resize(eventData, go$externalize((function(ev) {
			return handler(ev);
		}), (go$funcType([js.Object], [js.Object], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.ResizeDataFn = function(eventData, handler) { return this.go$val.ResizeDataFn(eventData, handler); };
	JQuery.Ptr.prototype.Scroll = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.scroll();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Scroll = function() { return this.go$val.Scroll(); };
	JQuery.Ptr.prototype.ScrollFn = function(handler) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.scroll(go$externalize((function() {
			handler();
		}), (go$funcType([], [], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.ScrollFn = function(handler) { return this.go$val.ScrollFn(handler); };
	JQuery.Ptr.prototype.ScrollDataFn = function(eventData, handler) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.scroll(eventData, go$externalize((function(ev) {
			return handler(ev);
		}), (go$funcType([js.Object], [js.Object], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.ScrollDataFn = function(eventData, handler) { return this.go$val.ScrollDataFn(eventData, handler); };
	JQuery.Ptr.prototype.FadeOut = function(duration) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.fadeOut(go$externalize(duration, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.FadeOut = function(duration) { return this.go$val.FadeOut(duration); };
	JQuery.Ptr.prototype.Select = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.select();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Select = function() { return this.go$val.Select(); };
	JQuery.Ptr.prototype.SelectFn = function(handler) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.select(go$externalize((function() {
			handler();
		}), (go$funcType([], [], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SelectFn = function(handler) { return this.go$val.SelectFn(handler); };
	JQuery.Ptr.prototype.SelectDataFn = function(eventData, handler) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.select(eventData, go$externalize((function(ev) {
			return handler(ev);
		}), (go$funcType([js.Object], [js.Object], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SelectDataFn = function(eventData, handler) { return this.go$val.SelectDataFn(eventData, handler); };
	JQuery.Ptr.prototype.Submit = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.submit();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Submit = function() { return this.go$val.Submit(); };
	JQuery.Ptr.prototype.SubmitFn = function(handler) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.submit(go$externalize((function() {
			handler();
		}), (go$funcType([], [], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SubmitFn = function(handler) { return this.go$val.SubmitFn(handler); };
	JQuery.Ptr.prototype.SubmitDataFn = function(eventData, handler) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.submit(eventData, go$externalize((function(e) {
			handler(new Event.Ptr(e, 0, null, null, 0));
		}), (go$funcType([js.Object], [], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.SubmitDataFn = function(eventData, handler) { return this.go$val.SubmitDataFn(eventData, handler); };
	JQuery.Ptr.prototype.Trigger = function(event) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.trigger(go$externalize(event, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Trigger = function(event) { return this.go$val.Trigger(event); };
	JQuery.Ptr.prototype.TriggerParam = function(eventType, extraParam) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.trigger(go$externalize(eventType, Go$String), go$externalize(extraParam, go$emptyInterface));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.TriggerParam = function(eventType, extraParam) { return this.go$val.TriggerParam(eventType, extraParam); };
	JQuery.Ptr.prototype.TriggerHandler = function(eventType, extraParam) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o = j.o.triggerHandler(go$externalize(eventType, Go$String), go$externalize(extraParam, go$emptyInterface));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.TriggerHandler = function(eventType, extraParam) { return this.go$val.TriggerHandler(eventType, extraParam); };
	JQuery.Ptr.prototype.Unbind = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.unbind();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Unbind = function() { return this.go$val.Unbind(); };
	JQuery.Ptr.prototype.UnbindEvent = function(eventType) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.unbind(eventType);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.UnbindEvent = function(eventType) { return this.go$val.UnbindEvent(eventType); };
	JQuery.Ptr.prototype.UnbindFn = function(eventType, handler) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.unbind(eventType, go$externalize((function(ev) {
			return handler(ev);
		}), (go$funcType([js.Object], [js.Object], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.UnbindFn = function(eventType, handler) { return this.go$val.UnbindFn(eventType, handler); };
	JQuery.Ptr.prototype.Undelegate = function() {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.undelegate();
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Undelegate = function() { return this.go$val.Undelegate(); };
	JQuery.Ptr.prototype.UndelegateEvent = function(eventType) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.undelegate(eventType);
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.UndelegateEvent = function(eventType) { return this.go$val.UndelegateEvent(eventType); };
	JQuery.Ptr.prototype.UndelegateNamespace = function(ns) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.undelegate(go$externalize(ns, Go$String));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.UndelegateNamespace = function(ns) { return this.go$val.UndelegateNamespace(ns); };
	JQuery.Ptr.prototype.UndelegateFn = function(eventType, handler) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.undelegate(eventType, go$externalize((function(ev) {
			return handler(ev);
		}), (go$funcType([js.Object], [js.Object], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.UndelegateFn = function(eventType, handler) { return this.go$val.UndelegateFn(eventType, handler); };
	JQuery.Ptr.prototype.Unload = function(handler) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.unload(go$externalize((function(ev) {
			return handler(new Event.Ptr(ev, 0, null, null, 0));
		}), (go$funcType([js.Object], [js.Object], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.Unload = function(handler) { return this.go$val.Unload(handler); };
	JQuery.Ptr.prototype.UnloadEventdata = function(eventData, handler) {
		var _struct, j, _struct$1;
		j = (_struct = this, new JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
		j.o.unload(eventData, go$externalize((function(ev) {
			return handler(new Event.Ptr(ev, 0, null, null, 0));
		}), (go$funcType([js.Object], [js.Object], false))));
		return (_struct$1 = j, new JQuery.Ptr(_struct$1.o, _struct$1.Jquery, _struct$1.Selector, _struct$1.Length, _struct$1.Context));
	};
	JQuery.prototype.UnloadEventdata = function(eventData, handler) { return this.go$val.UnloadEventdata(eventData, handler); };
	go$pkg.init = function() {
	};
	return go$pkg;
})();
go$packages["github.com/rusco/qunit"] = (function() {
	var go$pkg = {};
	var js = go$packages["github.com/gopherjs/gopherjs/js"];
	var QUnitAssert;
	QUnitAssert = go$newType(0, "Struct", "qunit.QUnitAssert", "QUnitAssert", "github.com/rusco/qunit", function(Object_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
	});
	QUnitAssert.prototype.Bool = function() { return this.go$val.Bool(); };
	QUnitAssert.Ptr.prototype.Bool = function() { return this.Object.Bool(); };
	QUnitAssert.prototype.Call = function(name, args) { return this.go$val.Call(name, args); };
	QUnitAssert.Ptr.prototype.Call = function(name, args) { return this.Object.Call(name, args); };
	QUnitAssert.prototype.Float = function() { return this.go$val.Float(); };
	QUnitAssert.Ptr.prototype.Float = function() { return this.Object.Float(); };
	QUnitAssert.prototype.Get = function(name) { return this.go$val.Get(name); };
	QUnitAssert.Ptr.prototype.Get = function(name) { return this.Object.Get(name); };
	QUnitAssert.prototype.Index = function(i) { return this.go$val.Index(i); };
	QUnitAssert.Ptr.prototype.Index = function(i) { return this.Object.Index(i); };
	QUnitAssert.prototype.Int = function() { return this.go$val.Int(); };
	QUnitAssert.Ptr.prototype.Int = function() { return this.Object.Int(); };
	QUnitAssert.prototype.Interface = function() { return this.go$val.Interface(); };
	QUnitAssert.Ptr.prototype.Interface = function() { return this.Object.Interface(); };
	QUnitAssert.prototype.Invoke = function(args) { return this.go$val.Invoke(args); };
	QUnitAssert.Ptr.prototype.Invoke = function(args) { return this.Object.Invoke(args); };
	QUnitAssert.prototype.IsNull = function() { return this.go$val.IsNull(); };
	QUnitAssert.Ptr.prototype.IsNull = function() { return this.Object.IsNull(); };
	QUnitAssert.prototype.IsUndefined = function() { return this.go$val.IsUndefined(); };
	QUnitAssert.Ptr.prototype.IsUndefined = function() { return this.Object.IsUndefined(); };
	QUnitAssert.prototype.Length = function() { return this.go$val.Length(); };
	QUnitAssert.Ptr.prototype.Length = function() { return this.Object.Length(); };
	QUnitAssert.prototype.New = function(args) { return this.go$val.New(args); };
	QUnitAssert.Ptr.prototype.New = function(args) { return this.Object.New(args); };
	QUnitAssert.prototype.Set = function(name, value) { return this.go$val.Set(name, value); };
	QUnitAssert.Ptr.prototype.Set = function(name, value) { return this.Object.Set(name, value); };
	QUnitAssert.prototype.SetIndex = function(i, value) { return this.go$val.SetIndex(i, value); };
	QUnitAssert.Ptr.prototype.SetIndex = function(i, value) { return this.Object.SetIndex(i, value); };
	QUnitAssert.prototype.String = function() { return this.go$val.String(); };
	QUnitAssert.Ptr.prototype.String = function() { return this.Object.String(); };
	go$pkg.QUnitAssert = QUnitAssert;
	var DoneCallbackObject;
	DoneCallbackObject = go$newType(0, "Struct", "qunit.DoneCallbackObject", "DoneCallbackObject", "github.com/rusco/qunit", function(Object_, Failed_, Passed_, Total_, Runtime_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
		this.Failed = Failed_ !== undefined ? Failed_ : 0;
		this.Passed = Passed_ !== undefined ? Passed_ : 0;
		this.Total = Total_ !== undefined ? Total_ : 0;
		this.Runtime = Runtime_ !== undefined ? Runtime_ : 0;
	});
	DoneCallbackObject.prototype.Bool = function() { return this.go$val.Bool(); };
	DoneCallbackObject.Ptr.prototype.Bool = function() { return this.Object.Bool(); };
	DoneCallbackObject.prototype.Call = function(name, args) { return this.go$val.Call(name, args); };
	DoneCallbackObject.Ptr.prototype.Call = function(name, args) { return this.Object.Call(name, args); };
	DoneCallbackObject.prototype.Float = function() { return this.go$val.Float(); };
	DoneCallbackObject.Ptr.prototype.Float = function() { return this.Object.Float(); };
	DoneCallbackObject.prototype.Get = function(name) { return this.go$val.Get(name); };
	DoneCallbackObject.Ptr.prototype.Get = function(name) { return this.Object.Get(name); };
	DoneCallbackObject.prototype.Index = function(i) { return this.go$val.Index(i); };
	DoneCallbackObject.Ptr.prototype.Index = function(i) { return this.Object.Index(i); };
	DoneCallbackObject.prototype.Int = function() { return this.go$val.Int(); };
	DoneCallbackObject.Ptr.prototype.Int = function() { return this.Object.Int(); };
	DoneCallbackObject.prototype.Interface = function() { return this.go$val.Interface(); };
	DoneCallbackObject.Ptr.prototype.Interface = function() { return this.Object.Interface(); };
	DoneCallbackObject.prototype.Invoke = function(args) { return this.go$val.Invoke(args); };
	DoneCallbackObject.Ptr.prototype.Invoke = function(args) { return this.Object.Invoke(args); };
	DoneCallbackObject.prototype.IsNull = function() { return this.go$val.IsNull(); };
	DoneCallbackObject.Ptr.prototype.IsNull = function() { return this.Object.IsNull(); };
	DoneCallbackObject.prototype.IsUndefined = function() { return this.go$val.IsUndefined(); };
	DoneCallbackObject.Ptr.prototype.IsUndefined = function() { return this.Object.IsUndefined(); };
	DoneCallbackObject.prototype.Length = function() { return this.go$val.Length(); };
	DoneCallbackObject.Ptr.prototype.Length = function() { return this.Object.Length(); };
	DoneCallbackObject.prototype.New = function(args) { return this.go$val.New(args); };
	DoneCallbackObject.Ptr.prototype.New = function(args) { return this.Object.New(args); };
	DoneCallbackObject.prototype.Set = function(name, value) { return this.go$val.Set(name, value); };
	DoneCallbackObject.Ptr.prototype.Set = function(name, value) { return this.Object.Set(name, value); };
	DoneCallbackObject.prototype.SetIndex = function(i, value) { return this.go$val.SetIndex(i, value); };
	DoneCallbackObject.Ptr.prototype.SetIndex = function(i, value) { return this.Object.SetIndex(i, value); };
	DoneCallbackObject.prototype.String = function() { return this.go$val.String(); };
	DoneCallbackObject.Ptr.prototype.String = function() { return this.Object.String(); };
	go$pkg.DoneCallbackObject = DoneCallbackObject;
	var LogCallbackObject;
	LogCallbackObject = go$newType(0, "Struct", "qunit.LogCallbackObject", "LogCallbackObject", "github.com/rusco/qunit", function(Object_, result_, actual_, expected_, message_, source_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
		this.result = result_ !== undefined ? result_ : false;
		this.actual = actual_ !== undefined ? actual_ : null;
		this.expected = expected_ !== undefined ? expected_ : null;
		this.message = message_ !== undefined ? message_ : "";
		this.source = source_ !== undefined ? source_ : "";
	});
	LogCallbackObject.prototype.Bool = function() { return this.go$val.Bool(); };
	LogCallbackObject.Ptr.prototype.Bool = function() { return this.Object.Bool(); };
	LogCallbackObject.prototype.Call = function(name, args) { return this.go$val.Call(name, args); };
	LogCallbackObject.Ptr.prototype.Call = function(name, args) { return this.Object.Call(name, args); };
	LogCallbackObject.prototype.Float = function() { return this.go$val.Float(); };
	LogCallbackObject.Ptr.prototype.Float = function() { return this.Object.Float(); };
	LogCallbackObject.prototype.Get = function(name) { return this.go$val.Get(name); };
	LogCallbackObject.Ptr.prototype.Get = function(name) { return this.Object.Get(name); };
	LogCallbackObject.prototype.Index = function(i) { return this.go$val.Index(i); };
	LogCallbackObject.Ptr.prototype.Index = function(i) { return this.Object.Index(i); };
	LogCallbackObject.prototype.Int = function() { return this.go$val.Int(); };
	LogCallbackObject.Ptr.prototype.Int = function() { return this.Object.Int(); };
	LogCallbackObject.prototype.Interface = function() { return this.go$val.Interface(); };
	LogCallbackObject.Ptr.prototype.Interface = function() { return this.Object.Interface(); };
	LogCallbackObject.prototype.Invoke = function(args) { return this.go$val.Invoke(args); };
	LogCallbackObject.Ptr.prototype.Invoke = function(args) { return this.Object.Invoke(args); };
	LogCallbackObject.prototype.IsNull = function() { return this.go$val.IsNull(); };
	LogCallbackObject.Ptr.prototype.IsNull = function() { return this.Object.IsNull(); };
	LogCallbackObject.prototype.IsUndefined = function() { return this.go$val.IsUndefined(); };
	LogCallbackObject.Ptr.prototype.IsUndefined = function() { return this.Object.IsUndefined(); };
	LogCallbackObject.prototype.Length = function() { return this.go$val.Length(); };
	LogCallbackObject.Ptr.prototype.Length = function() { return this.Object.Length(); };
	LogCallbackObject.prototype.New = function(args) { return this.go$val.New(args); };
	LogCallbackObject.Ptr.prototype.New = function(args) { return this.Object.New(args); };
	LogCallbackObject.prototype.Set = function(name, value) { return this.go$val.Set(name, value); };
	LogCallbackObject.Ptr.prototype.Set = function(name, value) { return this.Object.Set(name, value); };
	LogCallbackObject.prototype.SetIndex = function(i, value) { return this.go$val.SetIndex(i, value); };
	LogCallbackObject.Ptr.prototype.SetIndex = function(i, value) { return this.Object.SetIndex(i, value); };
	LogCallbackObject.prototype.String = function() { return this.go$val.String(); };
	LogCallbackObject.Ptr.prototype.String = function() { return this.Object.String(); };
	go$pkg.LogCallbackObject = LogCallbackObject;
	var ModuleStartCallbackObject;
	ModuleStartCallbackObject = go$newType(0, "Struct", "qunit.ModuleStartCallbackObject", "ModuleStartCallbackObject", "github.com/rusco/qunit", function(Object_, name_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
		this.name = name_ !== undefined ? name_ : "";
	});
	ModuleStartCallbackObject.prototype.Bool = function() { return this.go$val.Bool(); };
	ModuleStartCallbackObject.Ptr.prototype.Bool = function() { return this.Object.Bool(); };
	ModuleStartCallbackObject.prototype.Call = function(name, args) { return this.go$val.Call(name, args); };
	ModuleStartCallbackObject.Ptr.prototype.Call = function(name, args) { return this.Object.Call(name, args); };
	ModuleStartCallbackObject.prototype.Float = function() { return this.go$val.Float(); };
	ModuleStartCallbackObject.Ptr.prototype.Float = function() { return this.Object.Float(); };
	ModuleStartCallbackObject.prototype.Get = function(name) { return this.go$val.Get(name); };
	ModuleStartCallbackObject.Ptr.prototype.Get = function(name) { return this.Object.Get(name); };
	ModuleStartCallbackObject.prototype.Index = function(i) { return this.go$val.Index(i); };
	ModuleStartCallbackObject.Ptr.prototype.Index = function(i) { return this.Object.Index(i); };
	ModuleStartCallbackObject.prototype.Int = function() { return this.go$val.Int(); };
	ModuleStartCallbackObject.Ptr.prototype.Int = function() { return this.Object.Int(); };
	ModuleStartCallbackObject.prototype.Interface = function() { return this.go$val.Interface(); };
	ModuleStartCallbackObject.Ptr.prototype.Interface = function() { return this.Object.Interface(); };
	ModuleStartCallbackObject.prototype.Invoke = function(args) { return this.go$val.Invoke(args); };
	ModuleStartCallbackObject.Ptr.prototype.Invoke = function(args) { return this.Object.Invoke(args); };
	ModuleStartCallbackObject.prototype.IsNull = function() { return this.go$val.IsNull(); };
	ModuleStartCallbackObject.Ptr.prototype.IsNull = function() { return this.Object.IsNull(); };
	ModuleStartCallbackObject.prototype.IsUndefined = function() { return this.go$val.IsUndefined(); };
	ModuleStartCallbackObject.Ptr.prototype.IsUndefined = function() { return this.Object.IsUndefined(); };
	ModuleStartCallbackObject.prototype.Length = function() { return this.go$val.Length(); };
	ModuleStartCallbackObject.Ptr.prototype.Length = function() { return this.Object.Length(); };
	ModuleStartCallbackObject.prototype.New = function(args) { return this.go$val.New(args); };
	ModuleStartCallbackObject.Ptr.prototype.New = function(args) { return this.Object.New(args); };
	ModuleStartCallbackObject.prototype.Set = function(name, value) { return this.go$val.Set(name, value); };
	ModuleStartCallbackObject.Ptr.prototype.Set = function(name, value) { return this.Object.Set(name, value); };
	ModuleStartCallbackObject.prototype.SetIndex = function(i, value) { return this.go$val.SetIndex(i, value); };
	ModuleStartCallbackObject.Ptr.prototype.SetIndex = function(i, value) { return this.Object.SetIndex(i, value); };
	ModuleStartCallbackObject.prototype.String = function() { return this.go$val.String(); };
	ModuleStartCallbackObject.Ptr.prototype.String = function() { return this.Object.String(); };
	go$pkg.ModuleStartCallbackObject = ModuleStartCallbackObject;
	var ModuleDoneCallbackObject;
	ModuleDoneCallbackObject = go$newType(0, "Struct", "qunit.ModuleDoneCallbackObject", "ModuleDoneCallbackObject", "github.com/rusco/qunit", function(Object_, name_, failed_, passed_, total_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
		this.name = name_ !== undefined ? name_ : "";
		this.failed = failed_ !== undefined ? failed_ : 0;
		this.passed = passed_ !== undefined ? passed_ : 0;
		this.total = total_ !== undefined ? total_ : 0;
	});
	ModuleDoneCallbackObject.prototype.Bool = function() { return this.go$val.Bool(); };
	ModuleDoneCallbackObject.Ptr.prototype.Bool = function() { return this.Object.Bool(); };
	ModuleDoneCallbackObject.prototype.Call = function(name, args) { return this.go$val.Call(name, args); };
	ModuleDoneCallbackObject.Ptr.prototype.Call = function(name, args) { return this.Object.Call(name, args); };
	ModuleDoneCallbackObject.prototype.Float = function() { return this.go$val.Float(); };
	ModuleDoneCallbackObject.Ptr.prototype.Float = function() { return this.Object.Float(); };
	ModuleDoneCallbackObject.prototype.Get = function(name) { return this.go$val.Get(name); };
	ModuleDoneCallbackObject.Ptr.prototype.Get = function(name) { return this.Object.Get(name); };
	ModuleDoneCallbackObject.prototype.Index = function(i) { return this.go$val.Index(i); };
	ModuleDoneCallbackObject.Ptr.prototype.Index = function(i) { return this.Object.Index(i); };
	ModuleDoneCallbackObject.prototype.Int = function() { return this.go$val.Int(); };
	ModuleDoneCallbackObject.Ptr.prototype.Int = function() { return this.Object.Int(); };
	ModuleDoneCallbackObject.prototype.Interface = function() { return this.go$val.Interface(); };
	ModuleDoneCallbackObject.Ptr.prototype.Interface = function() { return this.Object.Interface(); };
	ModuleDoneCallbackObject.prototype.Invoke = function(args) { return this.go$val.Invoke(args); };
	ModuleDoneCallbackObject.Ptr.prototype.Invoke = function(args) { return this.Object.Invoke(args); };
	ModuleDoneCallbackObject.prototype.IsNull = function() { return this.go$val.IsNull(); };
	ModuleDoneCallbackObject.Ptr.prototype.IsNull = function() { return this.Object.IsNull(); };
	ModuleDoneCallbackObject.prototype.IsUndefined = function() { return this.go$val.IsUndefined(); };
	ModuleDoneCallbackObject.Ptr.prototype.IsUndefined = function() { return this.Object.IsUndefined(); };
	ModuleDoneCallbackObject.prototype.Length = function() { return this.go$val.Length(); };
	ModuleDoneCallbackObject.Ptr.prototype.Length = function() { return this.Object.Length(); };
	ModuleDoneCallbackObject.prototype.New = function(args) { return this.go$val.New(args); };
	ModuleDoneCallbackObject.Ptr.prototype.New = function(args) { return this.Object.New(args); };
	ModuleDoneCallbackObject.prototype.Set = function(name, value) { return this.go$val.Set(name, value); };
	ModuleDoneCallbackObject.Ptr.prototype.Set = function(name, value) { return this.Object.Set(name, value); };
	ModuleDoneCallbackObject.prototype.SetIndex = function(i, value) { return this.go$val.SetIndex(i, value); };
	ModuleDoneCallbackObject.Ptr.prototype.SetIndex = function(i, value) { return this.Object.SetIndex(i, value); };
	ModuleDoneCallbackObject.prototype.String = function() { return this.go$val.String(); };
	ModuleDoneCallbackObject.Ptr.prototype.String = function() { return this.Object.String(); };
	go$pkg.ModuleDoneCallbackObject = ModuleDoneCallbackObject;
	var TestDoneCallbackObject;
	TestDoneCallbackObject = go$newType(0, "Struct", "qunit.TestDoneCallbackObject", "TestDoneCallbackObject", "github.com/rusco/qunit", function(Object_, name_, module_, failed_, passed_, total_, duration_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
		this.name = name_ !== undefined ? name_ : "";
		this.module = module_ !== undefined ? module_ : "";
		this.failed = failed_ !== undefined ? failed_ : 0;
		this.passed = passed_ !== undefined ? passed_ : 0;
		this.total = total_ !== undefined ? total_ : 0;
		this.duration = duration_ !== undefined ? duration_ : 0;
	});
	TestDoneCallbackObject.prototype.Bool = function() { return this.go$val.Bool(); };
	TestDoneCallbackObject.Ptr.prototype.Bool = function() { return this.Object.Bool(); };
	TestDoneCallbackObject.prototype.Call = function(name, args) { return this.go$val.Call(name, args); };
	TestDoneCallbackObject.Ptr.prototype.Call = function(name, args) { return this.Object.Call(name, args); };
	TestDoneCallbackObject.prototype.Float = function() { return this.go$val.Float(); };
	TestDoneCallbackObject.Ptr.prototype.Float = function() { return this.Object.Float(); };
	TestDoneCallbackObject.prototype.Get = function(name) { return this.go$val.Get(name); };
	TestDoneCallbackObject.Ptr.prototype.Get = function(name) { return this.Object.Get(name); };
	TestDoneCallbackObject.prototype.Index = function(i) { return this.go$val.Index(i); };
	TestDoneCallbackObject.Ptr.prototype.Index = function(i) { return this.Object.Index(i); };
	TestDoneCallbackObject.prototype.Int = function() { return this.go$val.Int(); };
	TestDoneCallbackObject.Ptr.prototype.Int = function() { return this.Object.Int(); };
	TestDoneCallbackObject.prototype.Interface = function() { return this.go$val.Interface(); };
	TestDoneCallbackObject.Ptr.prototype.Interface = function() { return this.Object.Interface(); };
	TestDoneCallbackObject.prototype.Invoke = function(args) { return this.go$val.Invoke(args); };
	TestDoneCallbackObject.Ptr.prototype.Invoke = function(args) { return this.Object.Invoke(args); };
	TestDoneCallbackObject.prototype.IsNull = function() { return this.go$val.IsNull(); };
	TestDoneCallbackObject.Ptr.prototype.IsNull = function() { return this.Object.IsNull(); };
	TestDoneCallbackObject.prototype.IsUndefined = function() { return this.go$val.IsUndefined(); };
	TestDoneCallbackObject.Ptr.prototype.IsUndefined = function() { return this.Object.IsUndefined(); };
	TestDoneCallbackObject.prototype.Length = function() { return this.go$val.Length(); };
	TestDoneCallbackObject.Ptr.prototype.Length = function() { return this.Object.Length(); };
	TestDoneCallbackObject.prototype.New = function(args) { return this.go$val.New(args); };
	TestDoneCallbackObject.Ptr.prototype.New = function(args) { return this.Object.New(args); };
	TestDoneCallbackObject.prototype.Set = function(name, value) { return this.go$val.Set(name, value); };
	TestDoneCallbackObject.Ptr.prototype.Set = function(name, value) { return this.Object.Set(name, value); };
	TestDoneCallbackObject.prototype.SetIndex = function(i, value) { return this.go$val.SetIndex(i, value); };
	TestDoneCallbackObject.Ptr.prototype.SetIndex = function(i, value) { return this.Object.SetIndex(i, value); };
	TestDoneCallbackObject.prototype.String = function() { return this.go$val.String(); };
	TestDoneCallbackObject.Ptr.prototype.String = function() { return this.Object.String(); };
	go$pkg.TestDoneCallbackObject = TestDoneCallbackObject;
	var TestStartCallbackObject;
	TestStartCallbackObject = go$newType(0, "Struct", "qunit.TestStartCallbackObject", "TestStartCallbackObject", "github.com/rusco/qunit", function(Object_, name_, module_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
		this.name = name_ !== undefined ? name_ : "";
		this.module = module_ !== undefined ? module_ : "";
	});
	TestStartCallbackObject.prototype.Bool = function() { return this.go$val.Bool(); };
	TestStartCallbackObject.Ptr.prototype.Bool = function() { return this.Object.Bool(); };
	TestStartCallbackObject.prototype.Call = function(name, args) { return this.go$val.Call(name, args); };
	TestStartCallbackObject.Ptr.prototype.Call = function(name, args) { return this.Object.Call(name, args); };
	TestStartCallbackObject.prototype.Float = function() { return this.go$val.Float(); };
	TestStartCallbackObject.Ptr.prototype.Float = function() { return this.Object.Float(); };
	TestStartCallbackObject.prototype.Get = function(name) { return this.go$val.Get(name); };
	TestStartCallbackObject.Ptr.prototype.Get = function(name) { return this.Object.Get(name); };
	TestStartCallbackObject.prototype.Index = function(i) { return this.go$val.Index(i); };
	TestStartCallbackObject.Ptr.prototype.Index = function(i) { return this.Object.Index(i); };
	TestStartCallbackObject.prototype.Int = function() { return this.go$val.Int(); };
	TestStartCallbackObject.Ptr.prototype.Int = function() { return this.Object.Int(); };
	TestStartCallbackObject.prototype.Interface = function() { return this.go$val.Interface(); };
	TestStartCallbackObject.Ptr.prototype.Interface = function() { return this.Object.Interface(); };
	TestStartCallbackObject.prototype.Invoke = function(args) { return this.go$val.Invoke(args); };
	TestStartCallbackObject.Ptr.prototype.Invoke = function(args) { return this.Object.Invoke(args); };
	TestStartCallbackObject.prototype.IsNull = function() { return this.go$val.IsNull(); };
	TestStartCallbackObject.Ptr.prototype.IsNull = function() { return this.Object.IsNull(); };
	TestStartCallbackObject.prototype.IsUndefined = function() { return this.go$val.IsUndefined(); };
	TestStartCallbackObject.Ptr.prototype.IsUndefined = function() { return this.Object.IsUndefined(); };
	TestStartCallbackObject.prototype.Length = function() { return this.go$val.Length(); };
	TestStartCallbackObject.Ptr.prototype.Length = function() { return this.Object.Length(); };
	TestStartCallbackObject.prototype.New = function(args) { return this.go$val.New(args); };
	TestStartCallbackObject.Ptr.prototype.New = function(args) { return this.Object.New(args); };
	TestStartCallbackObject.prototype.Set = function(name, value) { return this.go$val.Set(name, value); };
	TestStartCallbackObject.Ptr.prototype.Set = function(name, value) { return this.Object.Set(name, value); };
	TestStartCallbackObject.prototype.SetIndex = function(i, value) { return this.go$val.SetIndex(i, value); };
	TestStartCallbackObject.Ptr.prototype.SetIndex = function(i, value) { return this.Object.SetIndex(i, value); };
	TestStartCallbackObject.prototype.String = function() { return this.go$val.String(); };
	TestStartCallbackObject.Ptr.prototype.String = function() { return this.Object.String(); };
	go$pkg.TestStartCallbackObject = TestStartCallbackObject;
	var Raises;
	Raises = go$newType(0, "Struct", "qunit.Raises", "Raises", "github.com/rusco/qunit", function(Object_, Raises_) {
		this.go$val = this;
		this.Object = Object_ !== undefined ? Object_ : null;
		this.Raises = Raises_ !== undefined ? Raises_ : null;
	});
	Raises.prototype.Bool = function() { return this.go$val.Bool(); };
	Raises.Ptr.prototype.Bool = function() { return this.Object.Bool(); };
	Raises.prototype.Call = function(name, args) { return this.go$val.Call(name, args); };
	Raises.Ptr.prototype.Call = function(name, args) { return this.Object.Call(name, args); };
	Raises.prototype.Float = function() { return this.go$val.Float(); };
	Raises.Ptr.prototype.Float = function() { return this.Object.Float(); };
	Raises.prototype.Get = function(name) { return this.go$val.Get(name); };
	Raises.Ptr.prototype.Get = function(name) { return this.Object.Get(name); };
	Raises.prototype.Index = function(i) { return this.go$val.Index(i); };
	Raises.Ptr.prototype.Index = function(i) { return this.Object.Index(i); };
	Raises.prototype.Int = function() { return this.go$val.Int(); };
	Raises.Ptr.prototype.Int = function() { return this.Object.Int(); };
	Raises.prototype.Interface = function() { return this.go$val.Interface(); };
	Raises.Ptr.prototype.Interface = function() { return this.Object.Interface(); };
	Raises.prototype.Invoke = function(args) { return this.go$val.Invoke(args); };
	Raises.Ptr.prototype.Invoke = function(args) { return this.Object.Invoke(args); };
	Raises.prototype.IsNull = function() { return this.go$val.IsNull(); };
	Raises.Ptr.prototype.IsNull = function() { return this.Object.IsNull(); };
	Raises.prototype.IsUndefined = function() { return this.go$val.IsUndefined(); };
	Raises.Ptr.prototype.IsUndefined = function() { return this.Object.IsUndefined(); };
	Raises.prototype.Length = function() { return this.go$val.Length(); };
	Raises.Ptr.prototype.Length = function() { return this.Object.Length(); };
	Raises.prototype.New = function(args) { return this.go$val.New(args); };
	Raises.Ptr.prototype.New = function(args) { return this.Object.New(args); };
	Raises.prototype.Set = function(name, value) { return this.go$val.Set(name, value); };
	Raises.Ptr.prototype.Set = function(name, value) { return this.Object.Set(name, value); };
	Raises.prototype.SetIndex = function(i, value) { return this.go$val.SetIndex(i, value); };
	Raises.Ptr.prototype.SetIndex = function(i, value) { return this.Object.SetIndex(i, value); };
	Raises.prototype.String = function() { return this.go$val.String(); };
	Raises.Ptr.prototype.String = function() { return this.Object.String(); };
	go$pkg.Raises = Raises;
	QUnitAssert.init([["", "", js.Object, ""]]);
	QUnitAssert.methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["DeepEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["Equal", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["NotDeepEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["NotEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["NotPropEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["NotStrictEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["Ok", "", [go$emptyInterface, Go$String], [go$emptyInterface], false], ["PropEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["StrictEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["String", "", [], [Go$String], false], ["Throws", "", [(go$funcType([], [go$emptyInterface], false)), Go$String], [go$emptyInterface], false], ["ThrowsExpected", "", [(go$funcType([], [go$emptyInterface], false)), go$emptyInterface, Go$String], [go$emptyInterface], false]];
	(go$ptrType(QUnitAssert)).methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["DeepEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["Equal", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["NotDeepEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["NotEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["NotPropEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["NotStrictEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["Ok", "", [go$emptyInterface, Go$String], [go$emptyInterface], false], ["PropEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["StrictEqual", "", [go$emptyInterface, go$emptyInterface, Go$String], [go$emptyInterface], false], ["String", "", [], [Go$String], false], ["Throws", "", [(go$funcType([], [go$emptyInterface], false)), Go$String], [go$emptyInterface], false], ["ThrowsExpected", "", [(go$funcType([], [go$emptyInterface], false)), go$emptyInterface, Go$String], [go$emptyInterface], false]];
	DoneCallbackObject.init([["", "", js.Object, ""], ["Failed", "", Go$Int, "js:\"failed\""], ["Passed", "", Go$Int, "js:\"passed\""], ["Total", "", Go$Int, "js:\"total\""], ["Runtime", "", Go$Int, "js:\"runtime\""]]);
	DoneCallbackObject.methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	(go$ptrType(DoneCallbackObject)).methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	LogCallbackObject.init([["", "", js.Object, ""], ["result", "github.com/rusco/qunit", Go$Bool, "js:\"result\""], ["actual", "github.com/rusco/qunit", js.Object, "js:\"actual\""], ["expected", "github.com/rusco/qunit", js.Object, "js:\"expected\""], ["message", "github.com/rusco/qunit", Go$String, "js:\"message\""], ["source", "github.com/rusco/qunit", Go$String, "js:\"source\""]]);
	LogCallbackObject.methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	(go$ptrType(LogCallbackObject)).methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	ModuleStartCallbackObject.init([["", "", js.Object, ""], ["name", "github.com/rusco/qunit", Go$String, "js:\"name\""]]);
	ModuleStartCallbackObject.methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	(go$ptrType(ModuleStartCallbackObject)).methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	ModuleDoneCallbackObject.init([["", "", js.Object, ""], ["name", "github.com/rusco/qunit", Go$String, "js:\"name\""], ["failed", "github.com/rusco/qunit", Go$Int, "js:\"failed\""], ["passed", "github.com/rusco/qunit", Go$Int, "js:\"passed\""], ["total", "github.com/rusco/qunit", Go$Int, "js:\"total\""]]);
	ModuleDoneCallbackObject.methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	(go$ptrType(ModuleDoneCallbackObject)).methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	TestDoneCallbackObject.init([["", "", js.Object, ""], ["name", "github.com/rusco/qunit", Go$String, "js:\"name\""], ["module", "github.com/rusco/qunit", Go$String, "js:\"module\""], ["failed", "github.com/rusco/qunit", Go$Int, "js:\"failed\""], ["passed", "github.com/rusco/qunit", Go$Int, "js:\"passed\""], ["total", "github.com/rusco/qunit", Go$Int, "js:\"total\""], ["duration", "github.com/rusco/qunit", Go$Int, "js:\"duration\""]]);
	TestDoneCallbackObject.methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	(go$ptrType(TestDoneCallbackObject)).methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	TestStartCallbackObject.init([["", "", js.Object, ""], ["name", "github.com/rusco/qunit", Go$String, "js:\"name\""], ["module", "github.com/rusco/qunit", Go$String, "js:\"module\""]]);
	TestStartCallbackObject.methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	(go$ptrType(TestStartCallbackObject)).methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	Raises.init([["", "", js.Object, ""], ["Raises", "", js.Object, "js:\"raises\""]]);
	Raises.methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	(go$ptrType(Raises)).methods = [["Bool", "", [], [Go$Bool], false], ["Call", "", [Go$String, (go$sliceType(go$emptyInterface))], [js.Object], true], ["Float", "", [], [Go$Float64], false], ["Get", "", [Go$String], [js.Object], false], ["Index", "", [Go$Int], [js.Object], false], ["Int", "", [], [Go$Int], false], ["Interface", "", [], [go$emptyInterface], false], ["Invoke", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["IsNull", "", [], [Go$Bool], false], ["IsUndefined", "", [], [Go$Bool], false], ["Length", "", [], [Go$Int], false], ["New", "", [(go$sliceType(go$emptyInterface))], [js.Object], true], ["Set", "", [Go$String, go$emptyInterface], [], false], ["SetIndex", "", [Go$Int, go$emptyInterface], [], false], ["String", "", [], [Go$String], false]];
	QUnitAssert.Ptr.prototype.DeepEqual = function(actual, expected, message) {
		var _struct, qa;
		qa = (_struct = this, new QUnitAssert.Ptr(_struct.Object));
		return qa.Object.deepEqual(go$externalize(actual, go$emptyInterface), go$externalize(expected, go$emptyInterface), go$externalize(message, Go$String));
	};
	QUnitAssert.prototype.DeepEqual = function(actual, expected, message) { return this.go$val.DeepEqual(actual, expected, message); };
	QUnitAssert.Ptr.prototype.Equal = function(actual, expected, message) {
		var _struct, qa;
		qa = (_struct = this, new QUnitAssert.Ptr(_struct.Object));
		return qa.Object.equal(go$externalize(actual, go$emptyInterface), go$externalize(expected, go$emptyInterface), go$externalize(message, Go$String));
	};
	QUnitAssert.prototype.Equal = function(actual, expected, message) { return this.go$val.Equal(actual, expected, message); };
	QUnitAssert.Ptr.prototype.NotDeepEqual = function(actual, expected, message) {
		var _struct, qa;
		qa = (_struct = this, new QUnitAssert.Ptr(_struct.Object));
		return qa.Object.notDeepEqual(go$externalize(actual, go$emptyInterface), go$externalize(expected, go$emptyInterface), go$externalize(message, Go$String));
	};
	QUnitAssert.prototype.NotDeepEqual = function(actual, expected, message) { return this.go$val.NotDeepEqual(actual, expected, message); };
	QUnitAssert.Ptr.prototype.NotEqual = function(actual, expected, message) {
		var _struct, qa;
		qa = (_struct = this, new QUnitAssert.Ptr(_struct.Object));
		return qa.Object.notEqual(go$externalize(actual, go$emptyInterface), go$externalize(expected, go$emptyInterface), go$externalize(message, Go$String));
	};
	QUnitAssert.prototype.NotEqual = function(actual, expected, message) { return this.go$val.NotEqual(actual, expected, message); };
	QUnitAssert.Ptr.prototype.NotPropEqual = function(actual, expected, message) {
		var _struct, qa;
		qa = (_struct = this, new QUnitAssert.Ptr(_struct.Object));
		return qa.Object.notPropEqual(go$externalize(actual, go$emptyInterface), go$externalize(expected, go$emptyInterface), go$externalize(message, Go$String));
	};
	QUnitAssert.prototype.NotPropEqual = function(actual, expected, message) { return this.go$val.NotPropEqual(actual, expected, message); };
	QUnitAssert.Ptr.prototype.PropEqual = function(actual, expected, message) {
		var _struct, qa;
		qa = (_struct = this, new QUnitAssert.Ptr(_struct.Object));
		return qa.Object.propEqual(go$externalize(actual, go$emptyInterface), go$externalize(expected, go$emptyInterface), go$externalize(message, Go$String));
	};
	QUnitAssert.prototype.PropEqual = function(actual, expected, message) { return this.go$val.PropEqual(actual, expected, message); };
	QUnitAssert.Ptr.prototype.NotStrictEqual = function(actual, expected, message) {
		var _struct, qa;
		qa = (_struct = this, new QUnitAssert.Ptr(_struct.Object));
		return qa.Object.notStrictEqual(go$externalize(actual, go$emptyInterface), go$externalize(expected, go$emptyInterface), go$externalize(message, Go$String));
	};
	QUnitAssert.prototype.NotStrictEqual = function(actual, expected, message) { return this.go$val.NotStrictEqual(actual, expected, message); };
	QUnitAssert.Ptr.prototype.Ok = function(state, message) {
		var _struct, qa;
		qa = (_struct = this, new QUnitAssert.Ptr(_struct.Object));
		return qa.Object.ok(go$externalize(state, go$emptyInterface), go$externalize(message, Go$String));
	};
	QUnitAssert.prototype.Ok = function(state, message) { return this.go$val.Ok(state, message); };
	QUnitAssert.Ptr.prototype.StrictEqual = function(actual, expected, message) {
		var _struct, qa;
		qa = (_struct = this, new QUnitAssert.Ptr(_struct.Object));
		return qa.Object.strictEqual(go$externalize(actual, go$emptyInterface), go$externalize(expected, go$emptyInterface), go$externalize(message, Go$String));
	};
	QUnitAssert.prototype.StrictEqual = function(actual, expected, message) { return this.go$val.StrictEqual(actual, expected, message); };
	QUnitAssert.Ptr.prototype.ThrowsExpected = function(block, expected, message) {
		var _struct, qa;
		qa = (_struct = this, new QUnitAssert.Ptr(_struct.Object));
		return qa.Object.throwsExpected(go$externalize(block, (go$funcType([], [go$emptyInterface], false))), go$externalize(expected, go$emptyInterface), go$externalize(message, Go$String));
	};
	QUnitAssert.prototype.ThrowsExpected = function(block, expected, message) { return this.go$val.ThrowsExpected(block, expected, message); };
	QUnitAssert.Ptr.prototype.Throws = function(block, message) {
		var _struct, qa;
		qa = (_struct = this, new QUnitAssert.Ptr(_struct.Object));
		return qa.Object.throws(go$externalize(block, (go$funcType([], [go$emptyInterface], false))), go$externalize(message, Go$String));
	};
	QUnitAssert.prototype.Throws = function(block, message) { return this.go$val.Throws(block, message); };
	var Test = go$pkg.Test = function(name, testFn) {
		go$global.QUnit.test(go$externalize(name, Go$String), go$externalize((function(e) {
			testFn(new QUnitAssert.Ptr(e));
		}), (go$funcType([js.Object], [], false))));
	};
	var TestExpected = go$pkg.TestExpected = function(title, expected, testFn) {
		var t;
		t = go$global.QUnit.test(go$externalize(title, Go$String), expected, go$externalize((function(e) {
			testFn(new QUnitAssert.Ptr(e));
		}), (go$funcType([js.Object], [], false))));
		return t;
	};
	var Start = go$pkg.Start = function() {
		return go$global.QUnit.start();
	};
	var StartDecrement = go$pkg.StartDecrement = function(decrement) {
		return go$global.QUnit.start(decrement);
	};
	var Stop = go$pkg.Stop = function() {
		return go$global.QUnit.stop();
	};
	var StopIncrement = go$pkg.StopIncrement = function(increment) {
		return go$global.QUnit.stop(increment);
	};
	var Begin = go$pkg.Begin = function(callbackFn) {
		var t;
		t = go$global.QUnit.begin(go$externalize((function() {
			callbackFn();
		}), (go$funcType([], [], false))));
		return t;
	};
	var Done = go$pkg.Done = function(callbackFn) {
		var t;
		t = go$global.QUnit.done(go$externalize((function(e) {
			callbackFn(new DoneCallbackObject.Ptr(e, 0, 0, 0, 0));
		}), (go$funcType([js.Object], [], false))));
		return t;
	};
	var Log = go$pkg.Log = function(callbackFn) {
		var t;
		t = go$global.QUnit.log(go$externalize((function(e) {
			callbackFn(new LogCallbackObject.Ptr(e, false, null, null, "", ""));
		}), (go$funcType([js.Object], [], false))));
		return t;
	};
	var ModuleDone = go$pkg.ModuleDone = function(callbackFn) {
		var t;
		t = go$global.QUnit.moduleDone(go$externalize((function(e) {
			callbackFn(new ModuleDoneCallbackObject.Ptr(e, "", 0, 0, 0));
		}), (go$funcType([js.Object], [], false))));
		return t;
	};
	var ModuleStart = go$pkg.ModuleStart = function(callbackFn) {
		var t;
		t = go$global.QUnit.moduleStart(go$externalize((function(e) {
			callbackFn(go$internalize(e, Go$String));
		}), (go$funcType([js.Object], [], false))));
		return t;
	};
	var TestDone = go$pkg.TestDone = function(callbackFn) {
		var t;
		t = go$global.QUnit.testDone(go$externalize((function(e) {
			callbackFn(new TestDoneCallbackObject.Ptr(e, "", "", 0, 0, 0, 0));
		}), (go$funcType([js.Object], [], false))));
		return t;
	};
	var TestStart = go$pkg.TestStart = function(callbackFn) {
		var t;
		t = go$global.QUnit.testStart(go$externalize((function(e) {
			callbackFn(new TestStartCallbackObject.Ptr(e, "", ""));
		}), (go$funcType([js.Object], [], false))));
		return t;
	};
	var AsyncTestExpected = go$pkg.AsyncTestExpected = function(name, expected, testFn) {
		var t;
		t = go$global.QUnit.asyncTestExpected(go$externalize(name, Go$String), go$externalize(expected, go$emptyInterface), go$externalize((function() {
			testFn();
		}), (go$funcType([], [], false))));
		return t;
	};
	var AsyncTest = go$pkg.AsyncTest = function(name, testFn) {
		var t;
		t = go$global.QUnit.asyncTest(go$externalize(name, Go$String), go$externalize((function() {
			testFn();
		}), (go$funcType([], [], false))));
		return t;
	};
	var Expect = go$pkg.Expect = function(amount) {
		return go$global.QUnit.expect(amount);
	};
	var Equiv = go$pkg.Equiv = function(a, b) {
		return go$global.QUnit.equip(go$externalize(a, go$emptyInterface), go$externalize(b, go$emptyInterface));
	};
	var Module = go$pkg.Module = function(name) {
		return go$global.QUnit.module(go$externalize(name, Go$String));
	};
	var Push = go$pkg.Push = function(result, actual, expected, message) {
		return go$global.QUnit.push(go$externalize(result, go$emptyInterface), go$externalize(actual, go$emptyInterface), go$externalize(expected, go$emptyInterface), go$externalize(message, Go$String));
	};
	var Reset = go$pkg.Reset = function() {
		return go$global.QUnit.reset();
	};
	go$pkg.init = function() {
	};
	return go$pkg;
})();
go$packages["errors"] = (function() {
	var go$pkg = {};
	var errorString;
	errorString = go$newType(0, "Struct", "errors.errorString", "errorString", "errors", function(s_) {
		this.go$val = this;
		this.s = s_ !== undefined ? s_ : "";
	});
	go$pkg.errorString = errorString;
	errorString.init([["s", "errors", Go$String, ""]]);
	(go$ptrType(errorString)).methods = [["Error", "", [], [Go$String], false]];
	var New = go$pkg.New = function(text) {
		return new errorString.Ptr(text);
	};
	errorString.Ptr.prototype.Error = function() {
		var e;
		e = this;
		return e.s;
	};
	errorString.prototype.Error = function() { return this.go$val.Error(); };
	go$pkg.init = function() {
	};
	return go$pkg;
})();
go$packages["math"] = (function() {
	var go$pkg = {};
	var _gamP, _gamQ, _gamS, p0R8, p0S8, p0R5, p0S5, p0R3, p0S3, p0R2, p0S2, q0R8, q0S8, q0R5, q0S5, q0R3, q0S3, q0R2, q0S2, p1R8, p1S8, p1R5, p1S5, p1R3, p1S3, p1R2, p1S2, q1R8, q1S8, q1R5, q1S5, q1R3, q1S3, q1R2, q1S2, _lgamA, _lgamR, _lgamS, _lgamT, _lgamU, _lgamV, _lgamW, pow10tab, _sin, _cos, _tanP, _tanQ, tanhP, tanhQ;
	var Abs = go$pkg.Abs = Math.abs;
	var abs = function(x) {
		if (x < 0) {
			return -x;
		} else if (x === 0) {
			return 0;
		}
		return x;
	};
	var Acosh = go$pkg.Acosh = function(x) {
		var t;
		if (x < 1 || IsNaN(x)) {
			return NaN();
		} else if (x === 1) {
			return 0;
		} else if (x >= 2.68435456e+08) {
			return Log(x) + 0.6931471805599453;
		} else if (x > 2) {
			return Log(2 * x - 1 / (x + Sqrt(x * x - 1)));
		}
		t = x - 1;
		return Log1p(t + Sqrt(2 * t + t * t));
	};
	var Asin = go$pkg.Asin = Math.asin;
	var asin = function(x) {
		var sign, temp;
		if (x === 0) {
			return x;
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		if (x > 1) {
			return NaN();
		}
		temp = Sqrt(1 - x * x);
		if (x > 0.7) {
			temp = 1.5707963267948966 - satan(temp / x);
		} else {
			temp = satan(x / temp);
		}
		if (sign) {
			temp = -temp;
		}
		return temp;
	};
	var Acos = go$pkg.Acos = Math.acos;
	var acos = function(x) {
		return 1.5707963267948966 - Asin(x);
	};
	var Asinh = go$pkg.Asinh = function(x) {
		var sign, temp;
		if (IsNaN(x) || IsInf(x, 0)) {
			return x;
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		temp = 0;
		if (x > 2.68435456e+08) {
			temp = Log(x) + 0.6931471805599453;
		} else if (x > 2) {
			temp = Log(2 * x + 1 / (Sqrt(x * x + 1) + x));
		} else if (x < 3.725290298461914e-09) {
			temp = x;
		} else {
			temp = Log1p(x + x * x / (1 + Sqrt(1 + x * x)));
		}
		if (sign) {
			temp = -temp;
		}
		return temp;
	};
	var xatan = function(x) {
		var z;
		z = x * x;
		z = z * ((((-0.8750608600031904 * z + -16.157537187333652) * z + -75.00855792314705) * z + -122.88666844901361) * z + -64.85021904942025) / (((((z + 24.858464901423062) * z + 165.02700983169885) * z + 432.88106049129027) * z + 485.3903996359137) * z + 194.5506571482614);
		z = x * z + x;
		return z;
	};
	var satan = function(x) {
		if (x <= 0.66) {
			return xatan(x);
		}
		if (x > 2.414213562373095) {
			return 1.5707963267948966 - xatan(1 / x) + 6.123233995736766e-17;
		}
		return 0.7853981633974483 + xatan((x - 1) / (x + 1)) + 3.061616997868383e-17;
	};
	var Atan = go$pkg.Atan = Math.atan;
	var atan = function(x) {
		if (x === 0) {
			return x;
		}
		if (x > 0) {
			return satan(x);
		}
		return -satan(-x);
	};
	var Atan2 = go$pkg.Atan2 = Math.atan2;
	var atan2 = function(y, x) {
		var q;
		if (IsNaN(y) || IsNaN(x)) {
			return NaN();
		} else if (y === 0) {
			if (x >= 0 && !Signbit(x)) {
				return Copysign(0, y);
			}
			return Copysign(3.141592653589793, y);
		} else if (x === 0) {
			return Copysign(1.5707963267948966, y);
		} else if (IsInf(x, 0)) {
			if (IsInf(x, 1)) {
				if (IsInf(y, 0)) {
					return Copysign(0.7853981633974483, y);
				} else {
					return Copysign(0, y);
				}
			}
			if (IsInf(y, 0)) {
				return Copysign(2.356194490192345, y);
			} else {
				return Copysign(3.141592653589793, y);
			}
		} else if (IsInf(y, 0)) {
			return Copysign(1.5707963267948966, y);
		}
		q = Atan(y / x);
		if (x < 0) {
			if (q <= 0) {
				return q + 3.141592653589793;
			}
			return q - 3.141592653589793;
		}
		return q;
	};
	var Atanh = go$pkg.Atanh = function(x) {
		var sign, temp;
		if (x < -1 || x > 1 || IsNaN(x)) {
			return NaN();
		} else if (x === 1) {
			return Inf(1);
		} else if (x === -1) {
			return Inf(-1);
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		temp = 0;
		if (x < 3.725290298461914e-09) {
			temp = x;
		} else if (x < 0.5) {
			temp = x + x;
			temp = 0.5 * Log1p(temp + temp * x / (1 - x));
		} else {
			temp = 0.5 * Log1p((x + x) / (1 - x));
		}
		if (sign) {
			temp = -temp;
		}
		return temp;
	};
	var Inf = go$pkg.Inf = function(sign) { return sign >= 0 ? 1/0 : -1/0; };
	var NaN = go$pkg.NaN = function() { return 0/0; };
	var IsNaN = go$pkg.IsNaN = function(f) { return f !== f; };
	var IsInf = go$pkg.IsInf = function(f, sign) { if (f === -1/0) { return sign <= 0; } if (f === 1/0) { return sign >= 0; } return false; };
	var normalize = function(x) {
		var y, exp$1, _tuple, _tuple$1;
		y = 0;
		exp$1 = 0;
		if (Abs(x) < 2.2250738585072014e-308) {
			_tuple = [x * 4.503599627370496e+15, -52], y = _tuple[0], exp$1 = _tuple[1];
			return [y, exp$1];
		}
		_tuple$1 = [x, 0], y = _tuple$1[0], exp$1 = _tuple$1[1];
		return [y, exp$1];
	};
	var Cbrt = go$pkg.Cbrt = function(x) {
		var sign, _tuple, f, e, _r, m, _ref, _q, y, s, t;
		if ((x === 0) || IsNaN(x) || IsInf(x, 0)) {
			return x;
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		_tuple = Frexp(x), f = _tuple[0], e = _tuple[1];
		m = (_r = e % 3, _r === _r ? _r : go$throwRuntimeError("integer divide by zero"));
		if (m > 0) {
			m = m - 3 >> 0;
			e = e - (m) >> 0;
		}
		_ref = m;
		if (_ref === 0) {
			f = 0.1662848358 * f + 1.096040958 - 0.4105032829 / (0.5649335816 + f);
		} else if (_ref === -1) {
			f = f * 0.5;
			f = 0.2639607233 * f + 0.8699282849 - 0.1629083358 / (0.2824667908 + f);
		} else {
			f = f * 0.25;
			f = 0.4190115298 * f + 0.6904625373 - 0.0646502159 / (0.1412333954 + f);
		}
		y = Ldexp(f, (_q = e / 3, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero")));
		s = y * y * y;
		t = s + x;
		y = y * ((t + x) / (s + t));
		s = (y * y * y - x) / x;
		y = y - (y * ((0.1728395061728395 * s - 0.2222222222222222) * s + 0.3333333333333333) * s);
		if (sign) {
			y = -y;
		}
		return y;
	};
	var Copysign = go$pkg.Copysign = function(x, y) { return (x < 0 || 1/x === 1/-0) !== (y < 0 || 1/y === 1/-0) ? -x : x; };
	var Dim = go$pkg.Dim = function(x, y) { return Math.max(x - y, 0); };
	var dim = function(x, y) {
		return max(x - y, 0);
	};
	var Max = go$pkg.Max = function(x, y) { return (x === 1/0 || y === 1/0) ? 1/0 : Math.max(x, y); };
	var max = function(x, y) {
		if (IsInf(x, 1) || IsInf(y, 1)) {
			return Inf(1);
		} else if (IsNaN(x) || IsNaN(y)) {
			return NaN();
		} else if ((x === 0) && (x === y)) {
			if (Signbit(x)) {
				return y;
			}
			return x;
		}
		if (x > y) {
			return x;
		}
		return y;
	};
	var Min = go$pkg.Min = function(x, y) { return (x === -1/0 || y === -1/0) ? -1/0 : Math.min(x, y); };
	var min = function(x, y) {
		if (IsInf(x, -1) || IsInf(y, -1)) {
			return Inf(-1);
		} else if (IsNaN(x) || IsNaN(y)) {
			return NaN();
		} else if ((x === 0) && (x === y)) {
			if (Signbit(x)) {
				return x;
			}
			return y;
		}
		if (x < y) {
			return x;
		}
		return y;
	};
	var Erf = go$pkg.Erf = function(x) {
		var sign, temp, z, r, s, y, s$1, P, Q, s$2, _tuple, R, S, x$1, z$1, r$1;
		if (IsNaN(x)) {
			return NaN();
		} else if (IsInf(x, 1)) {
			return 1;
		} else if (IsInf(x, -1)) {
			return -1;
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		if (x < 0.84375) {
			temp = 0;
			if (x < 3.725290298461914e-09) {
				if (x < 2.848094538889218e-306) {
					temp = 0.125 * (8 * x + 1.0270333367641007 * x);
				} else {
					temp = x + 0.1283791670955126 * x;
				}
			} else {
				z = x * x;
				r = 0.12837916709551256 + z * (-0.3250421072470015 + z * (-0.02848174957559851 + z * (-0.005770270296489442 + z * -2.3763016656650163e-05)));
				s = 1 + z * (0.39791722395915535 + z * (0.0650222499887673 + z * (0.005081306281875766 + z * (0.00013249473800432164 + z * -3.960228278775368e-06))));
				y = r / s;
				temp = x + x * y;
			}
			if (sign) {
				return -temp;
			}
			return temp;
		}
		if (x < 1.25) {
			s$1 = x - 1;
			P = -0.0023621185607526594 + s$1 * (0.41485611868374833 + s$1 * (-0.3722078760357013 + s$1 * (0.31834661990116175 + s$1 * (-0.11089469428239668 + s$1 * (0.035478304325618236 + s$1 * -0.002166375594868791)))));
			Q = 1 + s$1 * (0.10642088040084423 + s$1 * (0.540397917702171 + s$1 * (0.07182865441419627 + s$1 * (0.12617121980876164 + s$1 * (0.01363708391202905 + s$1 * 0.011984499846799107)))));
			if (sign) {
				return -0.8450629115104675 - P / Q;
			}
			return 0.8450629115104675 + P / Q;
		}
		if (x >= 6) {
			if (sign) {
				return -1;
			}
			return 1;
		}
		s$2 = 1 / (x * x);
		_tuple = [0, 0], R = _tuple[0], S = _tuple[1];
		if (x < 2.857142857142857) {
			R = -0.009864944034847148 + s$2 * (-0.6938585727071818 + s$2 * (-10.558626225323291 + s$2 * (-62.375332450326006 + s$2 * (-162.39666946257347 + s$2 * (-184.60509290671104 + s$2 * (-81.2874355063066 + s$2 * -9.814329344169145))))));
			S = 1 + s$2 * (19.651271667439257 + s$2 * (137.65775414351904 + s$2 * (434.56587747522923 + s$2 * (645.3872717332679 + s$2 * (429.00814002756783 + s$2 * (108.63500554177944 + s$2 * (6.570249770319282 + s$2 * -0.0604244152148581)))))));
		} else {
			R = -0.0098649429247001 + s$2 * (-0.799283237680523 + s$2 * (-17.757954917754752 + s$2 * (-160.63638485582192 + s$2 * (-637.5664433683896 + s$2 * (-1025.0951316110772 + s$2 * -483.5191916086514)))));
			S = 1 + s$2 * (30.33806074348246 + s$2 * (325.7925129965739 + s$2 * (1536.729586084437 + s$2 * (3199.8582195085955 + s$2 * (2553.0504064331644 + s$2 * (474.52854120695537 + s$2 * -22.44095244658582))))));
		}
		z$1 = Float64frombits((x$1 = Float64bits(x), new Go$Uint64(x$1.high & 4294967295, (x$1.low & 0) >>> 0)));
		r$1 = Exp(-z$1 * z$1 - 0.5625) * Exp((z$1 - x) * (z$1 + x) + R / S);
		if (sign) {
			return r$1 / x - 1;
		}
		return 1 - r$1 / x;
	};
	var Erfc = go$pkg.Erfc = function(x) {
		var sign, temp, z, r, s, y, s$1, P, Q, s$2, _tuple, R, S, x$1, z$1, r$1;
		if (IsNaN(x)) {
			return NaN();
		} else if (IsInf(x, 1)) {
			return 0;
		} else if (IsInf(x, -1)) {
			return 2;
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		if (x < 0.84375) {
			temp = 0;
			if (x < 1.3877787807814457e-17) {
				temp = x;
			} else {
				z = x * x;
				r = 0.12837916709551256 + z * (-0.3250421072470015 + z * (-0.02848174957559851 + z * (-0.005770270296489442 + z * -2.3763016656650163e-05)));
				s = 1 + z * (0.39791722395915535 + z * (0.0650222499887673 + z * (0.005081306281875766 + z * (0.00013249473800432164 + z * -3.960228278775368e-06))));
				y = r / s;
				if (x < 0.25) {
					temp = x + x * y;
				} else {
					temp = 0.5 + (x * y + (x - 0.5));
				}
			}
			if (sign) {
				return 1 + temp;
			}
			return 1 - temp;
		}
		if (x < 1.25) {
			s$1 = x - 1;
			P = -0.0023621185607526594 + s$1 * (0.41485611868374833 + s$1 * (-0.3722078760357013 + s$1 * (0.31834661990116175 + s$1 * (-0.11089469428239668 + s$1 * (0.035478304325618236 + s$1 * -0.002166375594868791)))));
			Q = 1 + s$1 * (0.10642088040084423 + s$1 * (0.540397917702171 + s$1 * (0.07182865441419627 + s$1 * (0.12617121980876164 + s$1 * (0.01363708391202905 + s$1 * 0.011984499846799107)))));
			if (sign) {
				return 1.8450629115104675 + P / Q;
			}
			return 0.15493708848953247 - P / Q;
		}
		if (x < 28) {
			s$2 = 1 / (x * x);
			_tuple = [0, 0], R = _tuple[0], S = _tuple[1];
			if (x < 2.857142857142857) {
				R = -0.009864944034847148 + s$2 * (-0.6938585727071818 + s$2 * (-10.558626225323291 + s$2 * (-62.375332450326006 + s$2 * (-162.39666946257347 + s$2 * (-184.60509290671104 + s$2 * (-81.2874355063066 + s$2 * -9.814329344169145))))));
				S = 1 + s$2 * (19.651271667439257 + s$2 * (137.65775414351904 + s$2 * (434.56587747522923 + s$2 * (645.3872717332679 + s$2 * (429.00814002756783 + s$2 * (108.63500554177944 + s$2 * (6.570249770319282 + s$2 * -0.0604244152148581)))))));
			} else {
				if (sign && x > 6) {
					return 2;
				}
				R = -0.0098649429247001 + s$2 * (-0.799283237680523 + s$2 * (-17.757954917754752 + s$2 * (-160.63638485582192 + s$2 * (-637.5664433683896 + s$2 * (-1025.0951316110772 + s$2 * -483.5191916086514)))));
				S = 1 + s$2 * (30.33806074348246 + s$2 * (325.7925129965739 + s$2 * (1536.729586084437 + s$2 * (3199.8582195085955 + s$2 * (2553.0504064331644 + s$2 * (474.52854120695537 + s$2 * -22.44095244658582))))));
			}
			z$1 = Float64frombits((x$1 = Float64bits(x), new Go$Uint64(x$1.high & 4294967295, (x$1.low & 0) >>> 0)));
			r$1 = Exp(-z$1 * z$1 - 0.5625) * Exp((z$1 - x) * (z$1 + x) + R / S);
			if (sign) {
				return 2 - r$1 / x;
			}
			return r$1 / x;
		}
		if (sign) {
			return 2;
		}
		return 0;
	};
	var Exp = go$pkg.Exp = Math.exp;
	var exp = function(x) {
		var k, hi, lo;
		if (IsNaN(x) || IsInf(x, 1)) {
			return x;
		} else if (IsInf(x, -1)) {
			return 0;
		} else if (x > 709.782712893384) {
			return Inf(1);
		} else if (x < -745.1332191019411) {
			return 0;
		} else if (-3.725290298461914e-09 < x && x < 3.725290298461914e-09) {
			return 1 + x;
		}
		k = 0;
		if (x < 0) {
			k = (1.4426950408889634 * x - 0.5 >> 0);
		} else if (x > 0) {
			k = (1.4426950408889634 * x + 0.5 >> 0);
		}
		hi = x - k * 0.6931471803691238;
		lo = k * 1.9082149292705877e-10;
		return expmulti(hi, lo, k);
	};
	var Exp2 = go$pkg.Exp2 = function(x) { return Math.pow(2, x); };
	var exp2 = function(x) {
		var k, t, hi, lo;
		if (IsNaN(x) || IsInf(x, 1)) {
			return x;
		} else if (IsInf(x, -1)) {
			return 0;
		} else if (x > 1023.9999999999999) {
			return Inf(1);
		} else if (x < -1074) {
			return 0;
		}
		k = 0;
		if (x > 0) {
			k = (x + 0.5 >> 0);
		} else if (x < 0) {
			k = (x - 0.5 >> 0);
		}
		t = x - k;
		hi = t * 0.6931471803691238;
		lo = -t * 1.9082149292705877e-10;
		return expmulti(hi, lo, k);
	};
	var expmulti = function(hi, lo, k) {
		var r, t, c, y;
		r = hi - lo;
		t = r * r;
		c = r - t * (0.16666666666666602 + t * (-0.0027777777777015593 + t * (6.613756321437934e-05 + t * (-1.6533902205465252e-06 + t * 4.1381367970572385e-08))));
		y = 1 - ((lo - (r * c) / (2 - c)) - hi);
		return Ldexp(y, k);
	};
	var Expm1 = go$pkg.Expm1 = function(x) { return expm1(x); };
	var expm1 = function(x) {
		var absx, sign, c, k, _tuple, hi, lo, t, hfx, hxs, r1, t$1, e, y, x$1, x$2, x$3, t$2, y$1, x$4, x$5, t$3, y$2, x$6, x$7;
		if (IsInf(x, 1) || IsNaN(x)) {
			return x;
		} else if (IsInf(x, -1)) {
			return -1;
		}
		absx = x;
		sign = false;
		if (x < 0) {
			absx = -absx;
			sign = true;
		}
		if (absx >= 38.816242111356935) {
			if (absx >= 709.782712893384) {
				return Inf(1);
			}
			if (sign) {
				return -1;
			}
		}
		c = 0;
		k = 0;
		if (absx > 0.34657359027997264) {
			_tuple = [0, 0], hi = _tuple[0], lo = _tuple[1];
			if (absx < 1.0397207708399179) {
				if (!sign) {
					hi = x - 0.6931471803691238;
					lo = 1.9082149292705877e-10;
					k = 1;
				} else {
					hi = x + 0.6931471803691238;
					lo = -1.9082149292705877e-10;
					k = -1;
				}
			} else {
				if (!sign) {
					k = (1.4426950408889634 * x + 0.5 >> 0);
				} else {
					k = (1.4426950408889634 * x - 0.5 >> 0);
				}
				t = k;
				hi = x - t * 0.6931471803691238;
				lo = t * 1.9082149292705877e-10;
			}
			x = hi - lo;
			c = (hi - x) - lo;
		} else if (absx < 5.551115123125783e-17) {
			return x;
		} else {
			k = 0;
		}
		hfx = 0.5 * x;
		hxs = x * hfx;
		r1 = 1 + hxs * (-0.03333333333333313 + hxs * (0.0015873015872548146 + hxs * (-7.93650757867488e-05 + hxs * (4.008217827329362e-06 + hxs * -2.0109921818362437e-07))));
		t$1 = 3 - r1 * hfx;
		e = hxs * ((r1 - t$1) / (6 - x * t$1));
		if (!((k === 0))) {
			e = x * (e - c) - c;
			e = e - (hxs);
			if (k === -1) {
				return 0.5 * (x - e) - 0.5;
			} else if (k === 1) {
				if (x < -0.25) {
					return -2 * (e - (x + 0.5));
				}
				return 1 + 2 * (x - e);
			} else if (k <= -2 || k > 56) {
				y = 1 - (e - x);
				y = Float64frombits((x$1 = Float64bits(y), x$2 = go$shiftLeft64(new Go$Uint64(0, k), 52), new Go$Uint64(x$1.high + x$2.high, x$1.low + x$2.low)));
				return y - 1;
			}
			if (k < 20) {
				t$2 = Float64frombits((x$3 = go$shiftRightUint64(new Go$Uint64(2097152, 0), (k >>> 0)), new Go$Uint64(1072693248 - x$3.high, 0 - x$3.low)));
				y$1 = t$2 - (e - x);
				y$1 = Float64frombits((x$4 = Float64bits(y$1), x$5 = go$shiftLeft64(new Go$Uint64(0, k), 52), new Go$Uint64(x$4.high + x$5.high, x$4.low + x$5.low)));
				return y$1;
			}
			t$3 = Float64frombits(new Go$Uint64(0, (((1023 - k >> 0)) << 52 >> 0)));
			y$2 = x - (e + t$3);
			y$2 = y$2 + 1;
			y$2 = Float64frombits((x$6 = Float64bits(y$2), x$7 = go$shiftLeft64(new Go$Uint64(0, k), 52), new Go$Uint64(x$6.high + x$7.high, x$6.low + x$7.low)));
			return y$2;
		}
		return x - (x * e - hxs);
	};
	var Floor = go$pkg.Floor = Math.floor;
	var floor = function(x) {
		var _tuple, d, fract, _tuple$1, d$1;
		if ((x === 0) || IsNaN(x) || IsInf(x, 0)) {
			return x;
		}
		if (x < 0) {
			_tuple = Modf(-x), d = _tuple[0], fract = _tuple[1];
			if (!((fract === 0))) {
				d = d + 1;
			}
			return -d;
		}
		_tuple$1 = Modf(x), d$1 = _tuple$1[0];
		return d$1;
	};
	var Ceil = go$pkg.Ceil = Math.ceil;
	var ceil = function(x) {
		return -Floor(-x);
	};
	var Trunc = go$pkg.Trunc = function(x) { return (x === 1/0 || x === -1/0 || x !== x || 1/x === 1/-0) ? x : x >> 0; };
	var trunc = function(x) {
		var _tuple, d;
		if ((x === 0) || IsNaN(x) || IsInf(x, 0)) {
			return x;
		}
		_tuple = Modf(x), d = _tuple[0];
		return d;
	};
	var Frexp = go$pkg.Frexp = function(f) { return frexp(f); };
	var frexp = function(f) {
		var frac, exp$1, _tuple, _tuple$1, _tuple$2, x, x$1;
		frac = 0;
		exp$1 = 0;
		if (f === 0) {
			_tuple = [f, 0], frac = _tuple[0], exp$1 = _tuple[1];
			return [frac, exp$1];
		} else if (IsInf(f, 0) || IsNaN(f)) {
			_tuple$1 = [f, 0], frac = _tuple$1[0], exp$1 = _tuple$1[1];
			return [frac, exp$1];
		}
		_tuple$2 = normalize(f), f = _tuple$2[0], exp$1 = _tuple$2[1];
		x = Float64bits(f);
		exp$1 = exp$1 + (((((x$1 = go$shiftRightUint64(x, 52), new Go$Uint64(x$1.high & 0, (x$1.low & 2047) >>> 0)).low >> 0) - 1023 >> 0) + 1 >> 0)) >> 0;
		x = new Go$Uint64(x.high &~ 2146435072, (x.low &~ 0) >>> 0);
		x = new Go$Uint64(x.high | 1071644672, (x.low | 0) >>> 0);
		frac = Float64frombits(x);
		return [frac, exp$1];
	};
	var stirling = function(x) {
		var w, y, v;
		w = 1 / x;
		w = 1 + w * ((((_gamS[0] * w + _gamS[1]) * w + _gamS[2]) * w + _gamS[3]) * w + _gamS[4]);
		y = Exp(x);
		if (x > 143.01608) {
			v = Pow(x, 0.5 * x - 0.25);
			y = v * (v / y);
		} else {
			y = Pow(x, x - 0.5) / y;
		}
		y = 2.5066282746310007 * y * w;
		return y;
	};
	var Gamma = go$pkg.Gamma = function(x) {
		var go$this = this, q, p, signgam, ip, z, z$1;
		/* */ var go$s = 0, go$f = function() { while (true) { switch (go$s) { case 0:
		if (isNegInt(x) || IsInf(x, -1) || IsNaN(x)) {
			return NaN();
		} else if (x === 0) {
			if (Signbit(x)) {
				return Inf(-1);
			}
			return Inf(1);
		} else if (x < -170.5674972726612 || x > 171.61447887182297) {
			return Inf(1);
		}
		q = Abs(x);
		p = Floor(q);
		if (q > 33) {
			if (x >= 0) {
				return stirling(x);
			}
			signgam = 1;
			if (ip = (p >> 0), (ip & 1) === 0) {
				signgam = -1;
			}
			z = q - p;
			if (z > 0.5) {
				p = p + 1;
				z = q - p;
			}
			z = q * Sin(3.141592653589793 * z);
			if (z === 0) {
				return Inf(signgam);
			}
			z = 3.141592653589793 / (Abs(z) * stirling(q));
			return signgam * z;
		}
		z$1 = 1;
		while (x >= 3) {
			x = x - 1;
			z$1 = z$1 * x;
		}
		/* while (x < 0) { */ case 2: if(!(x < 0)) { go$s = 3; continue; }
			/* if (x > -1e-09) { */ if (x > -1e-09) {} else { go$s = 4; continue; }
				/* goto small */ go$s = 1; continue;
			/* } */ case 4:
			z$1 = z$1 / x;
			x = x + 1;
		/* } */ go$s = 2; continue; case 3:
		/* while (x < 2) { */ case 5: if(!(x < 2)) { go$s = 6; continue; }
			/* if (x < 1e-09) { */ if (x < 1e-09) {} else { go$s = 7; continue; }
				/* goto small */ go$s = 1; continue;
			/* } */ case 7:
			z$1 = z$1 / x;
			x = x + 1;
		/* } */ go$s = 5; continue; case 6:
		if (x === 2) {
			return z$1;
		}
		x = x - 2;
		p = (((((x * _gamP[0] + _gamP[1]) * x + _gamP[2]) * x + _gamP[3]) * x + _gamP[4]) * x + _gamP[5]) * x + _gamP[6];
		q = ((((((x * _gamQ[0] + _gamQ[1]) * x + _gamQ[2]) * x + _gamQ[3]) * x + _gamQ[4]) * x + _gamQ[5]) * x + _gamQ[6]) * x + _gamQ[7];
		return z$1 * p / q;
		/* small: */ case 1:
		/* if (x === 0) { */ if (x === 0) {} else { go$s = 8; continue; }
			return Inf(1);
		/* } */ case 8:
		return z$1 / ((1 + 0.5772156649015329 * x) * x);
		/* */ } break; } }; return go$f();
	};
	var isNegInt = function(x) {
		var _tuple, xf;
		if (x < 0) {
			_tuple = Modf(x), xf = _tuple[1];
			return xf === 0;
		}
		return false;
	};
	var Hypot = go$pkg.Hypot = function(p, q) { return hypot(p, q); };
	var hypot = function(p, q) {
		var _tuple;
		if (IsInf(p, 0) || IsInf(q, 0)) {
			return Inf(1);
		} else if (IsNaN(p) || IsNaN(q)) {
			return NaN();
		}
		if (p < 0) {
			p = -p;
		}
		if (q < 0) {
			q = -q;
		}
		if (p < q) {
			_tuple = [q, p], p = _tuple[0], q = _tuple[1];
		}
		if (p === 0) {
			return 0;
		}
		q = q / p;
		return p * Sqrt(1 + q * q);
	};
	var J0 = go$pkg.J0 = function(x) {
		var _tuple, s, c, ss, cc, z, z$1, u, v, z$2, r, s$1, u$1;
		if (IsNaN(x)) {
			return x;
		} else if (IsInf(x, 0)) {
			return 0;
		} else if (x === 0) {
			return 1;
		}
		if (x < 0) {
			x = -x;
		}
		if (x >= 2) {
			_tuple = Sincos(x), s = _tuple[0], c = _tuple[1];
			ss = s - c;
			cc = s + c;
			if (x < 8.988465674311579e+307) {
				z = -Cos(x + x);
				if (s * c < 0) {
					cc = z / ss;
				} else {
					ss = z / cc;
				}
			}
			z$1 = 0;
			if (x > 6.80564733841877e+38) {
				z$1 = 0.5641895835477563 * cc / Sqrt(x);
			} else {
				u = pzero(x);
				v = qzero(x);
				z$1 = 0.5641895835477563 * (u * cc - v * ss) / Sqrt(x);
			}
			return z$1;
		}
		if (x < 0.0001220703125) {
			if (x < 7.450580596923828e-09) {
				return 1;
			}
			return 1 - 0.25 * x * x;
		}
		z$2 = x * x;
		r = z$2 * (0.015624999999999995 + z$2 * (-0.00018997929423885472 + z$2 * (1.8295404953270067e-06 + z$2 * -4.618326885321032e-09)));
		s$1 = 1 + z$2 * (0.015619102946489001 + z$2 * (0.00011692678466333745 + z$2 * (5.135465502073181e-07 + z$2 * 1.1661400333379e-09)));
		if (x < 1) {
			return 1 + z$2 * (-0.25 + (r / s$1));
		}
		u$1 = 0.5 * x;
		return (1 + u$1) * (1 - u$1) + z$2 * (r / s$1);
	};
	var Y0 = go$pkg.Y0 = function(x) {
		var _tuple, s, c, ss, cc, z, z$1, u, v, z$2, u$1, v$1;
		if (x < 0 || IsNaN(x)) {
			return NaN();
		} else if (IsInf(x, 1)) {
			return 0;
		} else if (x === 0) {
			return Inf(-1);
		}
		if (x >= 2) {
			_tuple = Sincos(x), s = _tuple[0], c = _tuple[1];
			ss = s - c;
			cc = s + c;
			if (x < 8.988465674311579e+307) {
				z = -Cos(x + x);
				if (s * c < 0) {
					cc = z / ss;
				} else {
					ss = z / cc;
				}
			}
			z$1 = 0;
			if (x > 6.80564733841877e+38) {
				z$1 = 0.5641895835477563 * ss / Sqrt(x);
			} else {
				u = pzero(x);
				v = qzero(x);
				z$1 = 0.5641895835477563 * (u * ss + v * cc) / Sqrt(x);
			}
			return z$1;
		}
		if (x <= 7.450580596923828e-09) {
			return -0.07380429510868723 + 0.6366197723675814 * Log(x);
		}
		z$2 = x * x;
		u$1 = -0.07380429510868723 + z$2 * (0.17666645250918112 + z$2 * (-0.01381856719455969 + z$2 * (0.00034745343209368365 + z$2 * (-3.8140705372436416e-06 + z$2 * (1.9559013703502292e-08 + z$2 * -3.982051941321034e-11)))));
		v$1 = 1 + z$2 * (0.01273048348341237 + z$2 * (7.600686273503533e-05 + z$2 * (2.591508518404578e-07 + z$2 * 4.4111031133267547e-10)));
		return u$1 / v$1 + 0.6366197723675814 * J0(x) * Log(x);
	};
	var pzero = function(x) {
		var p, q, z, r, s;
		p = go$makeNativeArray("Float64", 6, function() { return 0; });
		q = go$makeNativeArray("Float64", 5, function() { return 0; });
		if (x >= 8) {
			p = go$mapArray(p0R8, function(entry) { return entry; });
			q = go$mapArray(p0S8, function(entry) { return entry; });
		} else if (x >= 4.5454) {
			p = go$mapArray(p0R5, function(entry) { return entry; });
			q = go$mapArray(p0S5, function(entry) { return entry; });
		} else if (x >= 2.8571) {
			p = go$mapArray(p0R3, function(entry) { return entry; });
			q = go$mapArray(p0S3, function(entry) { return entry; });
		} else if (x >= 2) {
			p = go$mapArray(p0R2, function(entry) { return entry; });
			q = go$mapArray(p0S2, function(entry) { return entry; });
		}
		z = 1 / (x * x);
		r = p[0] + z * (p[1] + z * (p[2] + z * (p[3] + z * (p[4] + z * p[5]))));
		s = 1 + z * (q[0] + z * (q[1] + z * (q[2] + z * (q[3] + z * q[4]))));
		return 1 + r / s;
	};
	var qzero = function(x) {
		var _tuple, p, q, z, r, s;
		_tuple = [go$makeNativeArray("Float64", 6, function() { return 0; }), go$makeNativeArray("Float64", 6, function() { return 0; })], p = _tuple[0], q = _tuple[1];
		if (x >= 8) {
			p = go$mapArray(q0R8, function(entry) { return entry; });
			q = go$mapArray(q0S8, function(entry) { return entry; });
		} else if (x >= 4.5454) {
			p = go$mapArray(q0R5, function(entry) { return entry; });
			q = go$mapArray(q0S5, function(entry) { return entry; });
		} else if (x >= 2.8571) {
			p = go$mapArray(q0R3, function(entry) { return entry; });
			q = go$mapArray(q0S3, function(entry) { return entry; });
		} else if (x >= 2) {
			p = go$mapArray(q0R2, function(entry) { return entry; });
			q = go$mapArray(q0S2, function(entry) { return entry; });
		}
		z = 1 / (x * x);
		r = p[0] + z * (p[1] + z * (p[2] + z * (p[3] + z * (p[4] + z * p[5]))));
		s = 1 + z * (q[0] + z * (q[1] + z * (q[2] + z * (q[3] + z * (q[4] + z * q[5])))));
		return (-0.125 + r / s) / x;
	};
	var J1 = go$pkg.J1 = function(x) {
		var sign, _tuple, s, c, ss, cc, z, z$1, u, v, z$2, r, s$1;
		if (IsNaN(x)) {
			return x;
		} else if (IsInf(x, 0) || (x === 0)) {
			return 0;
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		if (x >= 2) {
			_tuple = Sincos(x), s = _tuple[0], c = _tuple[1];
			ss = -s - c;
			cc = s - c;
			if (x < 8.988465674311579e+307) {
				z = Cos(x + x);
				if (s * c > 0) {
					cc = z / ss;
				} else {
					ss = z / cc;
				}
			}
			z$1 = 0;
			if (x > 6.80564733841877e+38) {
				z$1 = 0.5641895835477563 * cc / Sqrt(x);
			} else {
				u = pone(x);
				v = qone(x);
				z$1 = 0.5641895835477563 * (u * cc - v * ss) / Sqrt(x);
			}
			if (sign) {
				return -z$1;
			}
			return z$1;
		}
		if (x < 7.450580596923828e-09) {
			return 0.5 * x;
		}
		z$2 = x * x;
		r = z$2 * (-0.0625 + z$2 * (0.001407056669551897 + z$2 * (-1.599556310840356e-05 + z$2 * 4.9672799960958445e-08)));
		s$1 = 1 + z$2 * (0.019153759953836346 + z$2 * (0.00018594678558863092 + z$2 * (1.1771846404262368e-06 + z$2 * (5.0463625707621704e-09 + z$2 * 1.2354227442613791e-11))));
		r = r * (x);
		z$2 = 0.5 * x + r / s$1;
		if (sign) {
			return -z$2;
		}
		return z$2;
	};
	var Y1 = go$pkg.Y1 = function(x) {
		var _tuple, s, c, ss, cc, z, z$1, u, v, z$2, u$1, v$1;
		if (x < 0 || IsNaN(x)) {
			return NaN();
		} else if (IsInf(x, 1)) {
			return 0;
		} else if (x === 0) {
			return Inf(-1);
		}
		if (x >= 2) {
			_tuple = Sincos(x), s = _tuple[0], c = _tuple[1];
			ss = -s - c;
			cc = s - c;
			if (x < 8.988465674311579e+307) {
				z = Cos(x + x);
				if (s * c > 0) {
					cc = z / ss;
				} else {
					ss = z / cc;
				}
			}
			z$1 = 0;
			if (x > 6.80564733841877e+38) {
				z$1 = 0.5641895835477563 * ss / Sqrt(x);
			} else {
				u = pone(x);
				v = qone(x);
				z$1 = 0.5641895835477563 * (u * ss + v * cc) / Sqrt(x);
			}
			return z$1;
		}
		if (x <= 5.551115123125783e-17) {
			return -0.6366197723675814 / x;
		}
		z$2 = x * x;
		u$1 = -0.19605709064623894 + z$2 * (0.05044387166398113 + z$2 * (-0.0019125689587576355 + z$2 * (2.352526005616105e-05 + z$2 * -9.190991580398789e-08)));
		v$1 = 1 + z$2 * (0.01991673182366499 + z$2 * (0.00020255258102513517 + z$2 * (1.3560880109751623e-06 + z$2 * (6.227414523646215e-09 + z$2 * 1.6655924620799208e-11))));
		return x * (u$1 / v$1) + 0.6366197723675814 * (J1(x) * Log(x) - 1 / x);
	};
	var pone = function(x) {
		var p, q, z, r, s;
		p = go$makeNativeArray("Float64", 6, function() { return 0; });
		q = go$makeNativeArray("Float64", 5, function() { return 0; });
		if (x >= 8) {
			p = go$mapArray(p1R8, function(entry) { return entry; });
			q = go$mapArray(p1S8, function(entry) { return entry; });
		} else if (x >= 4.5454) {
			p = go$mapArray(p1R5, function(entry) { return entry; });
			q = go$mapArray(p1S5, function(entry) { return entry; });
		} else if (x >= 2.8571) {
			p = go$mapArray(p1R3, function(entry) { return entry; });
			q = go$mapArray(p1S3, function(entry) { return entry; });
		} else if (x >= 2) {
			p = go$mapArray(p1R2, function(entry) { return entry; });
			q = go$mapArray(p1S2, function(entry) { return entry; });
		}
		z = 1 / (x * x);
		r = p[0] + z * (p[1] + z * (p[2] + z * (p[3] + z * (p[4] + z * p[5]))));
		s = 1 + z * (q[0] + z * (q[1] + z * (q[2] + z * (q[3] + z * q[4]))));
		return 1 + r / s;
	};
	var qone = function(x) {
		var _tuple, p, q, z, r, s;
		_tuple = [go$makeNativeArray("Float64", 6, function() { return 0; }), go$makeNativeArray("Float64", 6, function() { return 0; })], p = _tuple[0], q = _tuple[1];
		if (x >= 8) {
			p = go$mapArray(q1R8, function(entry) { return entry; });
			q = go$mapArray(q1S8, function(entry) { return entry; });
		} else if (x >= 4.5454) {
			p = go$mapArray(q1R5, function(entry) { return entry; });
			q = go$mapArray(q1S5, function(entry) { return entry; });
		} else if (x >= 2.8571) {
			p = go$mapArray(q1R3, function(entry) { return entry; });
			q = go$mapArray(q1S3, function(entry) { return entry; });
		} else if (x >= 2) {
			p = go$mapArray(q1R2, function(entry) { return entry; });
			q = go$mapArray(q1S2, function(entry) { return entry; });
		}
		z = 1 / (x * x);
		r = p[0] + z * (p[1] + z * (p[2] + z * (p[3] + z * (p[4] + z * p[5]))));
		s = 1 + z * (q[0] + z * (q[1] + z * (q[2] + z * (q[3] + z * (q[4] + z * q[5])))));
		return (0.375 + r / s) / x;
	};
	var Jn = go$pkg.Jn = function(n, x) {
		var _tuple, sign, b, temp, _ref, _tuple$1, i, a, _tuple$2, temp$1, a$1, i$1, w, h, q0, z, q1, k, _tuple$3, m, t, x$1, x$2, i$2, a$2, tmp, v, i$3, di, _tuple$4, i$4, di$1, _tuple$5;
		if (IsNaN(x)) {
			return x;
		} else if (IsInf(x, 0)) {
			return 0;
		}
		if (n === 0) {
			return J0(x);
		}
		if (x === 0) {
			return 0;
		}
		if (n < 0) {
			_tuple = [-n, -x], n = _tuple[0], x = _tuple[1];
		}
		if (n === 1) {
			return J1(x);
		}
		sign = false;
		if (x < 0) {
			x = -x;
			if ((n & 1) === 1) {
				sign = true;
			}
		}
		b = 0;
		if (n <= x) {
			if (x >= 8.148143905337944e+90) {
				temp = 0;
				_ref = n & 3;
				if (_ref === 0) {
					temp = Cos(x) + Sin(x);
				} else if (_ref === 1) {
					temp = -Cos(x) + Sin(x);
				} else if (_ref === 2) {
					temp = -Cos(x) - Sin(x);
				} else if (_ref === 3) {
					temp = Cos(x) - Sin(x);
				}
				b = 0.5641895835477563 * temp / Sqrt(x);
			} else {
				b = J1(x);
				_tuple$1 = [1, J0(x)], i = _tuple$1[0], a = _tuple$1[1];
				while (i < n) {
					_tuple$2 = [b, b * ((i + i >> 0) / x) - a], a = _tuple$2[0], b = _tuple$2[1];
					i = i + 1 >> 0;
				}
			}
		} else {
			if (x < 1.862645149230957e-09) {
				if (n > 33) {
					b = 0;
				} else {
					temp$1 = x * 0.5;
					b = temp$1;
					a$1 = 1;
					i$1 = 2;
					while (i$1 <= n) {
						a$1 = a$1 * (i$1);
						b = b * (temp$1);
						i$1 = i$1 + 1 >> 0;
					}
					b = b / (a$1);
				}
			} else {
				w = (n + n >> 0) / x;
				h = 2 / x;
				q0 = w;
				z = w + h;
				q1 = w * z - 1;
				k = 1;
				while (q1 < 1e+09) {
					k = k + 1 >> 0;
					z = z + (h);
					_tuple$3 = [q1, z * q1 - q0], q0 = _tuple$3[0], q1 = _tuple$3[1];
				}
				m = n + n >> 0;
				t = 0;
				i$2 = (x$1 = 2, x$2 = (n + k >> 0), (((x$1 >>> 16 << 16) * x$2 >> 0) + (x$1 << 16 >>> 16) * x$2) >> 0);
				while (i$2 >= m) {
					t = 1 / (i$2 / x - t);
					i$2 = i$2 - 2 >> 0;
				}
				a$2 = t;
				b = 1;
				tmp = n;
				v = 2 / x;
				tmp = tmp * Log(Abs(v * tmp));
				if (tmp < 709.782712893384) {
					i$3 = n - 1 >> 0;
					while (i$3 > 0) {
						di = (i$3 + i$3 >> 0);
						_tuple$4 = [b, b * di / x - a$2], a$2 = _tuple$4[0], b = _tuple$4[1];
						di = di - 2;
						i$3 = i$3 - 1 >> 0;
					}
				} else {
					i$4 = n - 1 >> 0;
					while (i$4 > 0) {
						di$1 = (i$4 + i$4 >> 0);
						_tuple$5 = [b, b * di$1 / x - a$2], a$2 = _tuple$5[0], b = _tuple$5[1];
						di$1 = di$1 - 2;
						if (b > 1e+100) {
							a$2 = a$2 / (b);
							t = t / (b);
							b = 1;
						}
						i$4 = i$4 - 1 >> 0;
					}
				}
				b = t * J0(x) / b;
			}
		}
		if (sign) {
			return -b;
		}
		return b;
	};
	var Yn = go$pkg.Yn = function(n, x) {
		var sign, b, temp, _ref, a, i, _tuple;
		if (x < 0 || IsNaN(x)) {
			return NaN();
		} else if (IsInf(x, 1)) {
			return 0;
		}
		if (n === 0) {
			return Y0(x);
		}
		if (x === 0) {
			if (n < 0 && ((n & 1) === 1)) {
				return Inf(1);
			}
			return Inf(-1);
		}
		sign = false;
		if (n < 0) {
			n = -n;
			if ((n & 1) === 1) {
				sign = true;
			}
		}
		if (n === 1) {
			if (sign) {
				return -Y1(x);
			}
			return Y1(x);
		}
		b = 0;
		if (x >= 8.148143905337944e+90) {
			temp = 0;
			_ref = n & 3;
			if (_ref === 0) {
				temp = Sin(x) - Cos(x);
			} else if (_ref === 1) {
				temp = -Sin(x) - Cos(x);
			} else if (_ref === 2) {
				temp = -Sin(x) + Cos(x);
			} else if (_ref === 3) {
				temp = Sin(x) + Cos(x);
			}
			b = 0.5641895835477563 * temp / Sqrt(x);
		} else {
			a = Y0(x);
			b = Y1(x);
			i = 1;
			while (i < n && !IsInf(b, -1)) {
				_tuple = [b, ((i + i >> 0) / x) * b - a], a = _tuple[0], b = _tuple[1];
				i = i + 1 >> 0;
			}
		}
		if (sign) {
			return -b;
		}
		return b;
	};
	var Ldexp = go$pkg.Ldexp = function(frac, exp) {
			if (frac === 0) { return frac; }
			if (exp >= 1024) { return frac * Math.pow(2, 1023) * Math.pow(2, exp - 1023); }
			if (exp <= -1024) { return frac * Math.pow(2, -1023) * Math.pow(2, exp + 1023); }
			return frac * Math.pow(2, exp);
		};
	var ldexp = function(frac, exp$1) {
		var _tuple, e, x, m, x$1;
		if (frac === 0) {
			return frac;
		} else if (IsInf(frac, 0) || IsNaN(frac)) {
			return frac;
		}
		_tuple = normalize(frac), frac = _tuple[0], e = _tuple[1];
		exp$1 = exp$1 + (e) >> 0;
		x = Float64bits(frac);
		exp$1 = exp$1 + ((((go$shiftRightUint64(x, 52).low >> 0) & 2047) - 1023 >> 0)) >> 0;
		if (exp$1 < -1074) {
			return Copysign(0, frac);
		}
		if (exp$1 > 1023) {
			if (frac < 0) {
				return Inf(-1);
			}
			return Inf(1);
		}
		m = 1;
		if (exp$1 < -1022) {
			exp$1 = exp$1 + 52 >> 0;
			m = 2.220446049250313e-16;
		}
		x = new Go$Uint64(x.high &~ 2146435072, (x.low &~ 0) >>> 0);
		x = (x$1 = go$shiftLeft64(new Go$Uint64(0, (exp$1 + 1023 >> 0)), 52), new Go$Uint64(x.high | x$1.high, (x.low | x$1.low) >>> 0));
		return m * Float64frombits(x);
	};
	var Lgamma = go$pkg.Lgamma = function(x) {
		var lgamma, sign, neg, nadj, t, y, i, _ref, z, p1, p2, p, z$1, w, p1$1, p2$1, p3, p$1, p1$2, p2$2, i$1, y$1, p$2, q, z$2, _ref$1, t$1, z$3, y$2, w$1;
		lgamma = 0;
		sign = 0;
		sign = 1;
		if (IsNaN(x)) {
			lgamma = x;
			return [lgamma, sign];
		} else if (IsInf(x, 0)) {
			lgamma = x;
			return [lgamma, sign];
		} else if (x === 0) {
			lgamma = Inf(1);
			return [lgamma, sign];
		}
		neg = false;
		if (x < 0) {
			x = -x;
			neg = true;
		}
		if (x < 8.470329472543003e-22) {
			if (neg) {
				sign = -1;
			}
			lgamma = -Log(x);
			return [lgamma, sign];
		}
		nadj = 0;
		if (neg) {
			if (x >= 4.503599627370496e+15) {
				lgamma = Inf(1);
				return [lgamma, sign];
			}
			t = sinPi(x);
			if (t === 0) {
				lgamma = Inf(1);
				return [lgamma, sign];
			}
			nadj = Log(3.141592653589793 / Abs(t * x));
			if (t < 0) {
				sign = -1;
			}
		}
		if ((x === 1) || (x === 2)) {
			lgamma = 0;
			return [lgamma, sign];
		} else if (x < 2) {
			y = 0;
			i = 0;
			if (x <= 0.9) {
				lgamma = -Log(x);
				if (x >= 0.7316321449683623) {
					y = 1 - x;
					i = 0;
				} else if (x >= 0.19163214496836226) {
					y = x - 0.46163214496836225;
					i = 1;
				} else {
					y = x;
					i = 2;
				}
			} else {
				lgamma = 0;
				if (x >= 1.7316321449683623) {
					y = 2 - x;
					i = 0;
				} else if (x >= 1.1916321449683622) {
					y = x - 1.4616321449683622;
					i = 1;
				} else {
					y = x - 1;
					i = 2;
				}
			}
			_ref = i;
			if (_ref === 0) {
				z = y * y;
				p1 = _lgamA[0] + z * (_lgamA[2] + z * (_lgamA[4] + z * (_lgamA[6] + z * (_lgamA[8] + z * _lgamA[10]))));
				p2 = z * (_lgamA[1] + z * (_lgamA[3] + z * (_lgamA[5] + z * (_lgamA[7] + z * (_lgamA[9] + z * _lgamA[11])))));
				p = y * p1 + p2;
				lgamma = lgamma + ((p - 0.5 * y));
			} else if (_ref === 1) {
				z$1 = y * y;
				w = z$1 * y;
				p1$1 = _lgamT[0] + w * (_lgamT[3] + w * (_lgamT[6] + w * (_lgamT[9] + w * _lgamT[12])));
				p2$1 = _lgamT[1] + w * (_lgamT[4] + w * (_lgamT[7] + w * (_lgamT[10] + w * _lgamT[13])));
				p3 = _lgamT[2] + w * (_lgamT[5] + w * (_lgamT[8] + w * (_lgamT[11] + w * _lgamT[14])));
				p$1 = z$1 * p1$1 - (-3.638676997039505e-18 - w * (p2$1 + y * p3));
				lgamma = lgamma + ((-0.12148629053584961 + p$1));
			} else if (_ref === 2) {
				p1$2 = y * (_lgamU[0] + y * (_lgamU[1] + y * (_lgamU[2] + y * (_lgamU[3] + y * (_lgamU[4] + y * _lgamU[5])))));
				p2$2 = 1 + y * (_lgamV[1] + y * (_lgamV[2] + y * (_lgamV[3] + y * (_lgamV[4] + y * _lgamV[5]))));
				lgamma = lgamma + ((-0.5 * y + p1$2 / p2$2));
			}
		} else if (x < 8) {
			i$1 = (x >> 0);
			y$1 = x - i$1;
			p$2 = y$1 * (_lgamS[0] + y$1 * (_lgamS[1] + y$1 * (_lgamS[2] + y$1 * (_lgamS[3] + y$1 * (_lgamS[4] + y$1 * (_lgamS[5] + y$1 * _lgamS[6]))))));
			q = 1 + y$1 * (_lgamR[1] + y$1 * (_lgamR[2] + y$1 * (_lgamR[3] + y$1 * (_lgamR[4] + y$1 * (_lgamR[5] + y$1 * _lgamR[6])))));
			lgamma = 0.5 * y$1 + p$2 / q;
			z$2 = 1;
			_ref$1 = i$1;
			if (_ref$1 === 7) {
				z$2 = z$2 * ((y$1 + 6));
				z$2 = z$2 * ((y$1 + 5));
				z$2 = z$2 * ((y$1 + 4));
				z$2 = z$2 * ((y$1 + 3));
				z$2 = z$2 * ((y$1 + 2));
				lgamma = lgamma + (Log(z$2));
			} else if (_ref$1 === 6) {
				z$2 = z$2 * ((y$1 + 5));
				z$2 = z$2 * ((y$1 + 4));
				z$2 = z$2 * ((y$1 + 3));
				z$2 = z$2 * ((y$1 + 2));
				lgamma = lgamma + (Log(z$2));
			} else if (_ref$1 === 5) {
				z$2 = z$2 * ((y$1 + 4));
				z$2 = z$2 * ((y$1 + 3));
				z$2 = z$2 * ((y$1 + 2));
				lgamma = lgamma + (Log(z$2));
			} else if (_ref$1 === 4) {
				z$2 = z$2 * ((y$1 + 3));
				z$2 = z$2 * ((y$1 + 2));
				lgamma = lgamma + (Log(z$2));
			} else if (_ref$1 === 3) {
				z$2 = z$2 * ((y$1 + 2));
				lgamma = lgamma + (Log(z$2));
			}
		} else if (x < 2.8823037615171174e+17) {
			t$1 = Log(x);
			z$3 = 1 / x;
			y$2 = z$3 * z$3;
			w$1 = _lgamW[0] + z$3 * (_lgamW[1] + y$2 * (_lgamW[2] + y$2 * (_lgamW[3] + y$2 * (_lgamW[4] + y$2 * (_lgamW[5] + y$2 * _lgamW[6])))));
			lgamma = (x - 0.5) * (t$1 - 1) + w$1;
		} else {
			lgamma = x * (Log(x) - 1);
		}
		if (neg) {
			lgamma = nadj - lgamma;
		}
		return [lgamma, sign];
	};
	var sinPi = function(x) {
		var z, n, x$1, _ref;
		if (x < 0.25) {
			return -Sin(3.141592653589793 * x);
		}
		z = Floor(x);
		n = 0;
		if (!((z === x))) {
			x = Mod(x, 2);
			n = (x * 4 >> 0);
		} else {
			if (x >= 9.007199254740992e+15) {
				x = 0;
				n = 0;
			} else {
				if (x < 4.503599627370496e+15) {
					z = x + 4.503599627370496e+15;
				}
				n = ((x$1 = Float64bits(z), new Go$Uint64(0 & x$1.high, (1 & x$1.low) >>> 0)).low >> 0);
				x = n;
				n = n << 2 >> 0;
			}
		}
		_ref = n;
		if (_ref === 0) {
			x = Sin(3.141592653589793 * x);
		} else if (_ref === 1 || _ref === 2) {
			x = Cos(3.141592653589793 * (0.5 - x));
		} else if (_ref === 3 || _ref === 4) {
			x = Sin(3.141592653589793 * (1 - x));
		} else if (_ref === 5 || _ref === 6) {
			x = -Cos(3.141592653589793 * (x - 1.5));
		} else {
			x = Sin(3.141592653589793 * (x - 2));
		}
		return -x;
	};
	var Log = go$pkg.Log = Math.log;
	var log = function(x) {
		var _tuple, f1, ki, f, k, s, s2, s4, t1, t2, R, hfsq;
		if (IsNaN(x) || IsInf(x, 1)) {
			return x;
		} else if (x < 0) {
			return NaN();
		} else if (x === 0) {
			return Inf(-1);
		}
		_tuple = Frexp(x), f1 = _tuple[0], ki = _tuple[1];
		if (f1 < 0.7071067811865476) {
			f1 = f1 * 2;
			ki = ki - 1 >> 0;
		}
		f = f1 - 1;
		k = ki;
		s = f / (2 + f);
		s2 = s * s;
		s4 = s2 * s2;
		t1 = s2 * (0.6666666666666735 + s4 * (0.2857142874366239 + s4 * (0.1818357216161805 + s4 * 0.14798198605116586)));
		t2 = s4 * (0.3999999999940942 + s4 * (0.22222198432149784 + s4 * 0.15313837699209373));
		R = t1 + t2;
		hfsq = 0.5 * f * f;
		return k * 0.6931471803691238 - ((hfsq - (s * (hfsq + R) + k * 1.9082149292705877e-10)) - f);
	};
	var Log10 = go$pkg.Log10 = function(x) { return log10(x); };
	var log10 = function(x) {
		return Log(x) * 0.4342944819032518;
	};
	var Log2 = go$pkg.Log2 = function(x) { return log2(x); };
	var log2 = function(x) {
		var _tuple, frac, exp$1;
		_tuple = Frexp(x), frac = _tuple[0], exp$1 = _tuple[1];
		return Log(frac) * 1.4426950408889634 + exp$1;
	};
	var Log1p = go$pkg.Log1p = function(x) { return log1p(x); };
	var log1p = function(x) {
		var absx, f, iu, k, c, u, x$1, x$2, hfsq, _tuple, s, R, z;
		if (x < -1 || IsNaN(x)) {
			return NaN();
		} else if (x === -1) {
			return Inf(-1);
		} else if (IsInf(x, 1)) {
			return Inf(1);
		}
		absx = x;
		if (absx < 0) {
			absx = -absx;
		}
		f = 0;
		iu = new Go$Uint64(0, 0);
		k = 1;
		if (absx < 0.41421356237309503) {
			if (absx < 1.862645149230957e-09) {
				if (absx < 5.551115123125783e-17) {
					return x;
				}
				return x - x * x * 0.5;
			}
			if (x > -0.2928932188134525) {
				k = 0;
				f = x;
				iu = new Go$Uint64(0, 1);
			}
		}
		c = 0;
		if (!((k === 0))) {
			u = 0;
			if (absx < 9.007199254740992e+15) {
				u = 1 + x;
				iu = Float64bits(u);
				k = ((x$1 = go$shiftRightUint64(iu, 52), new Go$Uint64(x$1.high - 0, x$1.low - 1023)).low >> 0);
				if (k > 0) {
					c = 1 - (u - x);
				} else {
					c = x - (u - 1);
					c = c / (u);
				}
			} else {
				u = x;
				iu = Float64bits(u);
				k = ((x$2 = go$shiftRightUint64(iu, 52), new Go$Uint64(x$2.high - 0, x$2.low - 1023)).low >> 0);
				c = 0;
			}
			iu = new Go$Uint64(iu.high & 1048575, (iu.low & 4294967295) >>> 0);
			if ((iu.high < 434334 || (iu.high === 434334 && iu.low < 1719614413))) {
				u = Float64frombits(new Go$Uint64(iu.high | 1072693248, (iu.low | 0) >>> 0));
			} else {
				k = k + 1 >> 0;
				u = Float64frombits(new Go$Uint64(iu.high | 1071644672, (iu.low | 0) >>> 0));
				iu = go$shiftRightUint64((new Go$Uint64(1048576 - iu.high, 0 - iu.low)), 2);
			}
			f = u - 1;
		}
		hfsq = 0.5 * f * f;
		_tuple = [0, 0, 0], s = _tuple[0], R = _tuple[1], z = _tuple[2];
		if ((iu.high === 0 && iu.low === 0)) {
			if (f === 0) {
				if (k === 0) {
					return 0;
				} else {
					c = c + (k * 1.9082149292705877e-10);
					return k * 0.6931471803691238 + c;
				}
			}
			R = hfsq * (1 - 0.6666666666666666 * f);
			if (k === 0) {
				return f - R;
			}
			return k * 0.6931471803691238 - ((R - (k * 1.9082149292705877e-10 + c)) - f);
		}
		s = f / (2 + f);
		z = s * s;
		R = z * (0.6666666666666735 + z * (0.3999999999940942 + z * (0.2857142874366239 + z * (0.22222198432149784 + z * (0.1818357216161805 + z * (0.15313837699209373 + z * 0.14798198605116586))))));
		if (k === 0) {
			return f - (hfsq - s * (hfsq + R));
		}
		return k * 0.6931471803691238 - ((hfsq - (s * (hfsq + R) + (k * 1.9082149292705877e-10 + c))) - f);
	};
	var Logb = go$pkg.Logb = function(x) {
		if (x === 0) {
			return Inf(-1);
		} else if (IsInf(x, 0)) {
			return Inf(1);
		} else if (IsNaN(x)) {
			return x;
		}
		return ilogb(x);
	};
	var Ilogb = go$pkg.Ilogb = function(x) {
		if (x === 0) {
			return -2147483648;
		} else if (IsNaN(x)) {
			return 2147483647;
		} else if (IsInf(x, 0)) {
			return 2147483647;
		}
		return ilogb(x);
	};
	var ilogb = function(x) {
		var _tuple, exp$1, x$1;
		_tuple = normalize(x), x = _tuple[0], exp$1 = _tuple[1];
		return (((x$1 = go$shiftRightUint64(Float64bits(x), 52), new Go$Uint64(x$1.high & 0, (x$1.low & 2047) >>> 0)).low >> 0) - 1023 >> 0) + exp$1 >> 0;
	};
	var Mod = go$pkg.Mod = function(x, y) { return x % y; };
	var mod = function(x, y) {
		var _tuple, yfr, yexp, sign, r, _tuple$1, rfr, rexp;
		if ((y === 0) || IsInf(x, 0) || IsNaN(x) || IsNaN(y)) {
			return NaN();
		}
		if (y < 0) {
			y = -y;
		}
		_tuple = Frexp(y), yfr = _tuple[0], yexp = _tuple[1];
		sign = false;
		r = x;
		if (x < 0) {
			r = -x;
			sign = true;
		}
		while (r >= y) {
			_tuple$1 = Frexp(r), rfr = _tuple$1[0], rexp = _tuple$1[1];
			if (rfr < yfr) {
				rexp = rexp - 1 >> 0;
			}
			r = r - Ldexp(y, rexp - yexp >> 0);
		}
		if (sign) {
			r = -r;
		}
		return r;
	};
	var Modf = go$pkg.Modf = function(f) { if (f === -1/0 || f === 1/0) { return [f, 0/0]; } var frac = f % 1; return [f - frac, frac]; };
	var modf = function(f) {
		var int$1, frac, _tuple, _tuple$1, _tuple$2, x, e, x$1, x$2;
		int$1 = 0;
		frac = 0;
		if (f < 1) {
			if (f < 0) {
				_tuple = Modf(-f), int$1 = _tuple[0], frac = _tuple[1];
				_tuple$1 = [-int$1, -frac], int$1 = _tuple$1[0], frac = _tuple$1[1];
				return [int$1, frac];
			}
			_tuple$2 = [0, f], int$1 = _tuple$2[0], frac = _tuple$2[1];
			return [int$1, frac];
		}
		x = Float64bits(f);
		e = (((go$shiftRightUint64(x, 52).low >>> 0) & 2047) >>> 0) - 1023 >>> 0;
		if (e < 52) {
			x = (x$1 = (x$2 = go$shiftLeft64(new Go$Uint64(0, 1), ((52 - e >>> 0))), new Go$Uint64(x$2.high - 0, x$2.low - 1)), new Go$Uint64(x.high &~ x$1.high, (x.low &~ x$1.low) >>> 0));
		}
		int$1 = Float64frombits(x);
		frac = f - int$1;
		return [int$1, frac];
	};
	var Nextafter = go$pkg.Nextafter = function(x, y) {
		var r, x$1, x$2;
		r = 0;
		if (IsNaN(x) || IsNaN(y)) {
			r = NaN();
		} else if (x === y) {
			r = x;
		} else if (x === 0) {
			r = Copysign(Float64frombits(new Go$Uint64(0, 1)), y);
		} else if ((y > x) === (x > 0)) {
			r = Float64frombits((x$1 = Float64bits(x), new Go$Uint64(x$1.high + 0, x$1.low + 1)));
		} else {
			r = Float64frombits((x$2 = Float64bits(x), new Go$Uint64(x$2.high - 0, x$2.low - 1)));
		}
		return r;
	};
	var isOddInt = function(x) {
		var _tuple, xi, xf, x$1, x$2;
		_tuple = Modf(x), xi = _tuple[0], xf = _tuple[1];
		return (xf === 0) && (x$1 = (x$2 = new Go$Int64(0, xi), new Go$Int64(x$2.high & 0, (x$2.low & 1) >>> 0)), (x$1.high === 0 && x$1.low === 1));
	};
	var Pow = go$pkg.Pow = function(x, y) { return ((x === 1) || (x === -1 && (y === -1/0 || y === 1/0))) ? 1 : Math.pow(x, y); };
	var Pow10 = go$pkg.Pow10 = function(e) {
		var _q, m;
		if (e <= -325) {
			return 0;
		} else if (e > 309) {
			return Inf(1);
		}
		if (e < 0) {
			return 1 / Pow10(-e);
		}
		if (e < 70) {
			return pow10tab[e];
		}
		m = (_q = e / 2, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
		return Pow10(m) * Pow10(e - m >> 0);
	};
	var Remainder = go$pkg.Remainder = function(x, y) { return remainder(x, y); };
	var remainder = function(x, y) {
		var sign, yHalf;
		if (IsNaN(x) || IsNaN(y) || IsInf(x, 0) || (y === 0)) {
			return NaN();
		} else if (IsInf(y, 0)) {
			return x;
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		if (y < 0) {
			y = -y;
		}
		if (x === y) {
			return 0;
		}
		if (y <= 8.988465674311579e+307) {
			x = Mod(x, y + y);
		}
		if (y < 4.450147717014403e-308) {
			if (x + x > y) {
				x = x - (y);
				if (x + x >= y) {
					x = x - (y);
				}
			}
		} else {
			yHalf = 0.5 * y;
			if (x > yHalf) {
				x = x - (y);
				if (x >= yHalf) {
					x = x - (y);
				}
			}
		}
		if (sign) {
			x = -x;
		}
		return x;
	};
	var Signbit = go$pkg.Signbit = function(x) { return x < 0 || 1/x === 1/-0; };
	var Cos = go$pkg.Cos = Math.cos;
	var cos = function(x) {
		var sign, j, y, x$1, z, zz;
		if (IsNaN(x) || IsInf(x, 0)) {
			return NaN();
		}
		sign = false;
		if (x < 0) {
			x = -x;
		}
		j = new Go$Int64(0, x * 1.2732395447351625);
		y = go$flatten64(j);
		if ((x$1 = new Go$Int64(j.high & 0, (j.low & 1) >>> 0), (x$1.high === 0 && x$1.low === 1))) {
			j = new Go$Int64(j.high + 0, j.low + 1);
			y = y + 1;
		}
		j = new Go$Int64(j.high & 0, (j.low & 7) >>> 0);
		if ((j.high > 0 || (j.high === 0 && j.low > 3))) {
			j = new Go$Int64(j.high - 0, j.low - 4);
			sign = !sign;
		}
		if ((j.high > 0 || (j.high === 0 && j.low > 1))) {
			sign = !sign;
		}
		z = ((x - y * 0.7853981256484985) - y * 3.774894707930798e-08) - y * 2.6951514290790595e-15;
		zz = z * z;
		if ((j.high === 0 && j.low === 1) || (j.high === 0 && j.low === 2)) {
			y = z + z * zz * ((((((_sin[0] * zz) + _sin[1]) * zz + _sin[2]) * zz + _sin[3]) * zz + _sin[4]) * zz + _sin[5]);
		} else {
			y = 1 - 0.5 * zz + zz * zz * ((((((_cos[0] * zz) + _cos[1]) * zz + _cos[2]) * zz + _cos[3]) * zz + _cos[4]) * zz + _cos[5]);
		}
		if (sign) {
			y = -y;
		}
		return y;
	};
	var Sin = go$pkg.Sin = Math.sin;
	var sin = function(x) {
		var sign, j, y, x$1, z, zz;
		if ((x === 0) || IsNaN(x)) {
			return x;
		} else if (IsInf(x, 0)) {
			return NaN();
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		j = new Go$Int64(0, x * 1.2732395447351625);
		y = go$flatten64(j);
		if ((x$1 = new Go$Int64(j.high & 0, (j.low & 1) >>> 0), (x$1.high === 0 && x$1.low === 1))) {
			j = new Go$Int64(j.high + 0, j.low + 1);
			y = y + 1;
		}
		j = new Go$Int64(j.high & 0, (j.low & 7) >>> 0);
		if ((j.high > 0 || (j.high === 0 && j.low > 3))) {
			sign = !sign;
			j = new Go$Int64(j.high - 0, j.low - 4);
		}
		z = ((x - y * 0.7853981256484985) - y * 3.774894707930798e-08) - y * 2.6951514290790595e-15;
		zz = z * z;
		if ((j.high === 0 && j.low === 1) || (j.high === 0 && j.low === 2)) {
			y = 1 - 0.5 * zz + zz * zz * ((((((_cos[0] * zz) + _cos[1]) * zz + _cos[2]) * zz + _cos[3]) * zz + _cos[4]) * zz + _cos[5]);
		} else {
			y = z + z * zz * ((((((_sin[0] * zz) + _sin[1]) * zz + _sin[2]) * zz + _sin[3]) * zz + _sin[4]) * zz + _sin[5]);
		}
		if (sign) {
			y = -y;
		}
		return y;
	};
	var Sincos = go$pkg.Sincos = function(x) { return [Math.sin(x), Math.cos(x)]; };
	var sincos = function(x) {
		var sin$1, cos$1, _tuple, _tuple$1, _tuple$2, sinSign, cosSign, j, y, x$1, _tuple$3, z, zz, _tuple$4;
		sin$1 = 0;
		cos$1 = 0;
		if (x === 0) {
			_tuple = [x, 1], sin$1 = _tuple[0], cos$1 = _tuple[1];
			return [sin$1, cos$1];
		} else if (IsNaN(x) || IsInf(x, 0)) {
			_tuple$1 = [NaN(), NaN()], sin$1 = _tuple$1[0], cos$1 = _tuple$1[1];
			return [sin$1, cos$1];
		}
		_tuple$2 = [false, false], sinSign = _tuple$2[0], cosSign = _tuple$2[1];
		if (x < 0) {
			x = -x;
			sinSign = true;
		}
		j = new Go$Int64(0, x * 1.2732395447351625);
		y = go$flatten64(j);
		if ((x$1 = new Go$Int64(j.high & 0, (j.low & 1) >>> 0), (x$1.high === 0 && x$1.low === 1))) {
			j = new Go$Int64(j.high + 0, j.low + 1);
			y = y + 1;
		}
		j = new Go$Int64(j.high & 0, (j.low & 7) >>> 0);
		if ((j.high > 0 || (j.high === 0 && j.low > 3))) {
			j = new Go$Int64(j.high - 0, j.low - 4);
			_tuple$3 = [!sinSign, !cosSign], sinSign = _tuple$3[0], cosSign = _tuple$3[1];
		}
		if ((j.high > 0 || (j.high === 0 && j.low > 1))) {
			cosSign = !cosSign;
		}
		z = ((x - y * 0.7853981256484985) - y * 3.774894707930798e-08) - y * 2.6951514290790595e-15;
		zz = z * z;
		cos$1 = 1 - 0.5 * zz + zz * zz * ((((((_cos[0] * zz) + _cos[1]) * zz + _cos[2]) * zz + _cos[3]) * zz + _cos[4]) * zz + _cos[5]);
		sin$1 = z + z * zz * ((((((_sin[0] * zz) + _sin[1]) * zz + _sin[2]) * zz + _sin[3]) * zz + _sin[4]) * zz + _sin[5]);
		if ((j.high === 0 && j.low === 1) || (j.high === 0 && j.low === 2)) {
			_tuple$4 = [cos$1, sin$1], sin$1 = _tuple$4[0], cos$1 = _tuple$4[1];
		}
		if (cosSign) {
			cos$1 = -cos$1;
		}
		if (sinSign) {
			sin$1 = -sin$1;
		}
		return [sin$1, cos$1];
	};
	var Sinh = go$pkg.Sinh = function(x) {
		var sign, temp, _ref, sq;
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		temp = 0;
		_ref = true;
		if (_ref === x > 21) {
			temp = Exp(x) / 2;
		} else if (_ref === x > 0.5) {
			temp = (Exp(x) - Exp(-x)) / 2;
		} else {
			sq = x * x;
			temp = (((-26.30563213397497 * sq + -2894.211355989564) * sq + -89912.72022039509) * sq + -630767.3640497717) * x;
			temp = temp / (((sq + -173.6789535582337) * sq + 15215.17378790019) * sq + -630767.3640497717);
		}
		if (sign) {
			temp = -temp;
		}
		return temp;
	};
	var Cosh = go$pkg.Cosh = function(x) {
		if (x < 0) {
			x = -x;
		}
		if (x > 21) {
			return Exp(x) / 2;
		}
		return (Exp(x) + Exp(-x)) / 2;
	};
	var Sqrt = go$pkg.Sqrt = Math.sqrt;
	var sqrt = function(x) {
		var ix, x$1, exp$1, x$2, _tuple, q, s, r, t, x$3, x$4, x$5, x$6, x$7;
		if ((x === 0) || IsNaN(x) || IsInf(x, 1)) {
			return x;
		} else if (x < 0) {
			return NaN();
		}
		ix = Float64bits(x);
		exp$1 = ((x$1 = go$shiftRightUint64(ix, 52), new Go$Uint64(x$1.high & 0, (x$1.low & 2047) >>> 0)).low >> 0);
		if (exp$1 === 0) {
			while ((x$2 = go$shiftLeft64(new Go$Uint64(ix.high & 0, (ix.low & 1) >>> 0), 52), (x$2.high === 0 && x$2.low === 0))) {
				ix = go$shiftLeft64(ix, 1);
				exp$1 = exp$1 - 1 >> 0;
			}
			exp$1 = exp$1 + 1 >> 0;
		}
		exp$1 = exp$1 - 1023 >> 0;
		ix = new Go$Uint64(ix.high &~ 2146435072, (ix.low &~ 0) >>> 0);
		ix = new Go$Uint64(ix.high | 1048576, (ix.low | 0) >>> 0);
		if ((exp$1 & 1) === 1) {
			ix = go$shiftLeft64(ix, 1);
		}
		exp$1 = exp$1 >> 1 >> 0;
		ix = go$shiftLeft64(ix, 1);
		_tuple = [new Go$Uint64(0, 0), new Go$Uint64(0, 0)], q = _tuple[0], s = _tuple[1];
		r = new Go$Uint64(2097152, 0);
		while (!((r.high === 0 && r.low === 0))) {
			t = new Go$Uint64(s.high + r.high, s.low + r.low);
			if ((t.high < ix.high || (t.high === ix.high && t.low <= ix.low))) {
				s = new Go$Uint64(t.high + r.high, t.low + r.low);
				ix = (x$3 = t, new Go$Uint64(ix.high - x$3.high, ix.low - x$3.low));
				q = (x$4 = r, new Go$Uint64(q.high + x$4.high, q.low + x$4.low));
			}
			ix = go$shiftLeft64(ix, 1);
			r = go$shiftRightUint64(r, 1);
		}
		if (!((ix.high === 0 && ix.low === 0))) {
			q = (x$5 = new Go$Uint64(q.high & 0, (q.low & 1) >>> 0), new Go$Uint64(q.high + x$5.high, q.low + x$5.low));
		}
		ix = (x$6 = go$shiftRightUint64(q, 1), x$7 = go$shiftLeft64(new Go$Uint64(0, ((exp$1 - 1 >> 0) + 1023 >> 0)), 52), new Go$Uint64(x$6.high + x$7.high, x$6.low + x$7.low));
		return Float64frombits(ix);
	};
	var sqrtC = function(f, r) {
		r.go$set(sqrt(f));
	};
	var Tan = go$pkg.Tan = Math.tan;
	var tan = function(x) {
		var sign, j, y, x$1, z, zz, x$2;
		if ((x === 0) || IsNaN(x)) {
			return x;
		} else if (IsInf(x, 0)) {
			return NaN();
		}
		sign = false;
		if (x < 0) {
			x = -x;
			sign = true;
		}
		j = new Go$Int64(0, x * 1.2732395447351625);
		y = go$flatten64(j);
		if ((x$1 = new Go$Int64(j.high & 0, (j.low & 1) >>> 0), (x$1.high === 0 && x$1.low === 1))) {
			j = new Go$Int64(j.high + 0, j.low + 1);
			y = y + 1;
		}
		z = ((x - y * 0.7853981256484985) - y * 3.774894707930798e-08) - y * 2.6951514290790595e-15;
		zz = z * z;
		if (zz > 1e-14) {
			y = z + z * (zz * (((_tanP[0] * zz) + _tanP[1]) * zz + _tanP[2]) / ((((zz + _tanQ[1]) * zz + _tanQ[2]) * zz + _tanQ[3]) * zz + _tanQ[4]));
		} else {
			y = z;
		}
		if ((x$2 = new Go$Int64(j.high & 0, (j.low & 2) >>> 0), (x$2.high === 0 && x$2.low === 2))) {
			y = -1 / y;
		}
		if (sign) {
			y = -y;
		}
		return y;
	};
	var Tanh = go$pkg.Tanh = function(x) {
		var z, s, s$1;
		z = Abs(x);
		if (z > 44.014845965556525) {
			if (x < 0) {
				return -1;
			}
			return 1;
		} else if (z >= 0.625) {
			s = Exp(2 * z);
			z = 1 - 2 / (s + 1);
			if (x < 0) {
				z = -z;
			}
		} else {
			if (x === 0) {
				return x;
			}
			s$1 = x * x;
			z = x + x * s$1 * ((tanhP[0] * s$1 + tanhP[1]) * s$1 + tanhP[2]) / (((s$1 + tanhQ[0]) * s$1 + tanhQ[1]) * s$1 + tanhQ[2]);
		}
		return z;
	};
	var Float32bits = go$pkg.Float32bits = go$float32bits;
	var Float32frombits = go$pkg.Float32frombits = function(b) {
			var s, e, m;
			s = 1;
			if (!(((b & 2147483648) >>> 0) === 0)) {
				s = -1;
			}
			e = (((((b >>> 23) >>> 0)) & 255) >>> 0);
			m = ((b & 8388607) >>> 0);
			if (e === 255) {
				if (m === 0) {
					return s / 0;
				}
				return 0/0;
			}
			if (!(e === 0)) {
				m = (m + (8388608) >>> 0);
			}
			if (e === 0) {
				e = 1;
			}
			return Ldexp(m, e - 127 - 23) * s;
		};
	var Float64bits = go$pkg.Float64bits = function(f) {
			var s, e, x, y, x$1, y$1, x$2, y$2;
			if (f === 0) {
				if (f === 0 && 1 / f === 1 / -0) {
					return new Go$Uint64(2147483648, 0);
				}
				return new Go$Uint64(0, 0);
			}
			if (!(f === f)) {
				return new Go$Uint64(2146959360, 1);
			}
			s = new Go$Uint64(0, 0);
			if (f < 0) {
				s = new Go$Uint64(2147483648, 0);
				f = -f;
			}
			e = 1075;
			while (f >= 9.007199254740992e+15) {
				f = f / (2);
				if (e === 2047) {
					break;
				}
				e = (e + (1) >>> 0);
			}
			while (f < 4.503599627370496e+15) {
				e = (e - (1) >>> 0);
				if (e === 0) {
					break;
				}
				f = f * (2);
			}
			return (x$2 = (x = s, y = go$shiftLeft64(new Go$Uint64(0, e), 52), new Go$Uint64(x.high | y.high, (x.low | y.low) >>> 0)), y$2 = ((x$1 = new Go$Uint64(0, f), y$1 = new Go$Uint64(1048576, 0), new Go$Uint64(x$1.high &~ y$1.high, (x$1.low &~ y$1.low) >>> 0))), new Go$Uint64(x$2.high | y$2.high, (x$2.low | y$2.low) >>> 0));
		};
	var Float64frombits = go$pkg.Float64frombits = function(b) {
			var s, x, y, x$1, y$1, x$2, y$2, e, x$3, y$3, m, x$4, y$4, x$5, y$5, x$6, y$6, x$7, y$7, x$8, y$8;
			s = 1;
			if (!((x$1 = (x = b, y = new Go$Uint64(2147483648, 0), new Go$Uint64(x.high & y.high, (x.low & y.low) >>> 0)), y$1 = new Go$Uint64(0, 0), x$1.high === y$1.high && x$1.low === y$1.low))) {
				s = -1;
			}
			e = (x$2 = (go$shiftRightUint64(b, 52)), y$2 = new Go$Uint64(0, 2047), new Go$Uint64(x$2.high & y$2.high, (x$2.low & y$2.low) >>> 0));
			m = (x$3 = b, y$3 = new Go$Uint64(1048575, 4294967295), new Go$Uint64(x$3.high & y$3.high, (x$3.low & y$3.low) >>> 0));
			if ((x$4 = e, y$4 = new Go$Uint64(0, 2047), x$4.high === y$4.high && x$4.low === y$4.low)) {
				if ((x$5 = m, y$5 = new Go$Uint64(0, 0), x$5.high === y$5.high && x$5.low === y$5.low)) {
					return s / 0;
				}
				return 0/0;
			}
			if (!((x$6 = e, y$6 = new Go$Uint64(0, 0), x$6.high === y$6.high && x$6.low === y$6.low))) {
				m = (x$7 = m, y$7 = (new Go$Uint64(1048576, 0)), new Go$Uint64(x$7.high + y$7.high, x$7.low + y$7.low));
			}
			if ((x$8 = e, y$8 = new Go$Uint64(0, 0), x$8.high === y$8.high && x$8.low === y$8.low)) {
				e = new Go$Uint64(0, 1);
			}
			return Ldexp((m.high * 4294967296 + m.low), e.low - 1023 - 52) * s;
		};
	go$pkg.init = function() {
		pow10tab = go$makeNativeArray("Float64", 70, function() { return 0; });
		var i, _q, m;
		_gamP = go$toNativeArray("Float64", [0.00016011952247675185, 0.0011913514700658638, 0.010421379756176158, 0.04763678004571372, 0.20744822764843598, 0.4942148268014971, 1]);
		_gamQ = go$toNativeArray("Float64", [-2.3158187332412014e-05, 0.0005396055804933034, -0.004456419138517973, 0.011813978522206043, 0.035823639860549865, -0.23459179571824335, 0.0714304917030273, 1]);
		_gamS = go$toNativeArray("Float64", [0.0007873113957930937, -0.00022954996161337813, -0.0026813261780578124, 0.0034722222160545866, 0.08333333333334822]);
		p0R8 = go$toNativeArray("Float64", [0, -0.07031249999999004, -8.081670412753498, -257.06310567970485, -2485.216410094288, -5253.043804907295]);
		p0S8 = go$toNativeArray("Float64", [116.53436461966818, 3833.7447536412183, 40597.857264847255, 116752.97256437592, 47627.728414673096]);
		p0R5 = go$toNativeArray("Float64", [-1.141254646918945e-11, -0.07031249408735993, -4.159610644705878, -67.67476522651673, -331.23129964917297, -346.4333883656049]);
		p0S5 = go$toNativeArray("Float64", [60.753938269230034, 1051.2523059570458, 5978.970943338558, 9625.445143577745, 2406.058159229391]);
		p0R3 = go$toNativeArray("Float64", [-2.547046017719519e-09, -0.07031196163814817, -2.409032215495296, -21.96597747348831, -58.07917047017376, -31.44794705948885]);
		p0S3 = go$toNativeArray("Float64", [35.85603380552097, 361.51398305030386, 1193.6078379211153, 1127.9967985690741, 173.58093081333575]);
		p0R2 = go$toNativeArray("Float64", [-8.875343330325264e-08, -0.07030309954836247, -1.4507384678095299, -7.635696138235278, -11.193166886035675, -3.2336457935133534]);
		p0S2 = go$toNativeArray("Float64", [22.22029975320888, 136.2067942182152, 270.4702786580835, 153.87539420832033, 14.65761769482562]);
		q0R8 = go$toNativeArray("Float64", [0, 0.0732421874999935, 11.76820646822527, 557.6733802564019, 8859.197207564686, 37014.62677768878]);
		q0S8 = go$toNativeArray("Float64", [163.77602689568982, 8098.344946564498, 142538.29141912048, 803309.2571195144, 840501.5798190605, -343899.2935378666]);
		q0R5 = go$toNativeArray("Float64", [1.8408596359451553e-11, 0.07324217666126848, 5.8356350896205695, 135.11157728644983, 1027.243765961641, 1989.9778586460538]);
		q0S5 = go$toNativeArray("Float64", [82.77661022365378, 2077.81416421393, 18847.28877857181, 56751.11228949473, 35976.75384251145, -5354.342756019448]);
		q0R3 = go$toNativeArray("Float64", [4.377410140897386e-09, 0.07324111800429114, 3.344231375161707, 42.621844074541265, 170.8080913405656, 166.73394869665117]);
		q0S3 = go$toNativeArray("Float64", [48.75887297245872, 709.689221056606, 3704.1482262011136, 6460.425167525689, 2516.3336892036896, -149.2474518361564]);
		q0R2 = go$toNativeArray("Float64", [1.5044444488698327e-07, 0.07322342659630793, 1.99819174093816, 14.495602934788574, 31.666231750478154, 16.252707571092927]);
		q0S2 = go$toNativeArray("Float64", [30.36558483552192, 269.34811860804984, 844.7837575953201, 882.9358451124886, 212.66638851179883, -5.3109549388266695]);
		p1R8 = go$toNativeArray("Float64", [0, 0.11718749999998865, 13.239480659307358, 412.05185430737856, 3874.7453891396053, 7914.479540318917]);
		p1S8 = go$toNativeArray("Float64", [114.20737037567841, 3650.9308342085346, 36956.206026903346, 97602.79359349508, 30804.27206278888]);
		p1R5 = go$toNativeArray("Float64", [1.3199051955624352e-11, 0.1171874931906141, 6.802751278684329, 108.30818299018911, 517.6361395331998, 528.7152013633375]);
		p1S5 = go$toNativeArray("Float64", [59.28059872211313, 991.4014187336144, 5353.26695291488, 7844.690317495512, 1504.0468881036106]);
		p1R3 = go$toNativeArray("Float64", [3.025039161373736e-09, 0.11718686556725359, 3.9329775003331564, 35.11940355916369, 91.05501107507813, 48.55906851973649]);
		p1S3 = go$toNativeArray("Float64", [34.79130950012515, 336.76245874782575, 1046.8713997577513, 890.8113463982564, 103.78793243963928]);
		p1R2 = go$toNativeArray("Float64", [1.0771083010687374e-07, 0.11717621946268335, 2.368514966676088, 12.242610914826123, 17.693971127168773, 5.073523125888185]);
		p1S2 = go$toNativeArray("Float64", [21.43648593638214, 125.29022716840275, 232.2764690571628, 117.6793732871471, 8.364638933716183]);
		q1R8 = go$toNativeArray("Float64", [0, -0.10253906249999271, -16.271753454459, -759.6017225139501, -11849.806670242959, -48438.512428575035]);
		q1S8 = go$toNativeArray("Float64", [161.3953697007229, 7825.385999233485, 133875.33628724958, 719657.7236832409, 666601.2326177764, -294490.26430383464]);
		q1R5 = go$toNativeArray("Float64", [-2.089799311417641e-11, -0.10253905024137543, -8.05644828123936, -183.66960747488838, -1373.1937606550816, -2612.4444045321566]);
		q1S5 = go$toNativeArray("Float64", [81.27655013843358, 1991.7987346048596, 17468.48519249089, 49851.42709103523, 27948.075163891812, -4719.183547951285]);
		q1R3 = go$toNativeArray("Float64", [-5.078312264617666e-09, -0.10253782982083709, -4.610115811394734, -57.847221656278364, -228.2445407376317, -219.21012847890933]);
		q1S3 = go$toNativeArray("Float64", [47.66515503237295, 673.8651126766997, 3380.1528667952634, 5547.729097207228, 1903.119193388108, -135.20119144430734]);
		q1R2 = go$toNativeArray("Float64", [-1.7838172751095887e-07, -0.10251704260798555, -2.7522056827818746, -19.663616264370372, -42.32531333728305, -21.371921170370406]);
		q1S2 = go$toNativeArray("Float64", [29.533362906052385, 252.98154998219053, 757.5028348686454, 739.3932053204672, 155.94900333666612, -4.959498988226282]);
		_lgamA = go$toNativeArray("Float64", [0.07721566490153287, 0.3224670334241136, 0.06735230105312927, 0.020580808432516733, 0.007385550860814029, 0.0028905138367341563, 0.0011927076318336207, 0.0005100697921535113, 0.00022086279071390839, 0.00010801156724758394, 2.5214456545125733e-05, 4.4864094961891516e-05]);
		_lgamR = go$toNativeArray("Float64", [1, 1.3920053346762105, 0.7219355475671381, 0.17193386563280308, 0.01864591917156529, 0.0007779424963818936, 7.326684307446256e-06]);
		_lgamS = go$toNativeArray("Float64", [-0.07721566490153287, 0.21498241596060885, 0.325778796408931, 0.14635047265246445, 0.02664227030336386, 0.0018402845140733772, 3.194753265841009e-05]);
		_lgamT = go$toNativeArray("Float64", [0.48383612272381005, -0.1475877229945939, 0.06462494023913339, -0.032788541075985965, 0.01797067508118204, -0.010314224129834144, 0.006100538702462913, -0.0036845201678113826, 0.0022596478090061247, -0.0014034646998923284, 0.000881081882437654, -0.0005385953053567405, 0.00031563207090362595, -0.00031275416837512086, 0.0003355291926355191]);
		_lgamU = go$toNativeArray("Float64", [-0.07721566490153287, 0.6328270640250934, 1.4549225013723477, 0.9777175279633727, 0.22896372806469245, 0.013381091853678766]);
		_lgamV = go$toNativeArray("Float64", [1, 2.4559779371304113, 2.128489763798934, 0.7692851504566728, 0.10422264559336913, 0.003217092422824239]);
		_lgamW = go$toNativeArray("Float64", [0.4189385332046727, 0.08333333333333297, -0.0027777777772877554, 0.0007936505586430196, -0.00059518755745034, 0.0008363399189962821, -0.0016309293409657527]);
		_sin = go$toNativeArray("Float64", [1.5896230157654656e-10, -2.5050747762857807e-08, 2.7557313621385722e-06, -0.0001984126982958954, 0.008333333333322118, -0.1666666666666663]);
		_cos = go$toNativeArray("Float64", [-1.1358536521387682e-11, 2.087570084197473e-09, -2.755731417929674e-07, 2.4801587288851704e-05, -0.0013888888888873056, 0.041666666666666595]);
		_tanP = go$toNativeArray("Float64", [-13093.693918138379, 1.1535166483858742e+06, -1.7956525197648488e+07]);
		_tanQ = go$toNativeArray("Float64", [1, 13681.296347069296, -1.3208923444021097e+06, 2.500838018233579e+07, -5.3869575592945464e+07]);
		tanhP = go$toNativeArray("Float64", [-0.9643991794250523, -99.28772310019185, -1614.6876844170845]);
		tanhQ = go$toNativeArray("Float64", [112.81167849163293, 2235.4883906010045, 4844.063053251255]);
		pow10tab[0] = 1;
		pow10tab[1] = 10;
		i = 2;
		while (i < 70) {
			m = (_q = i / 2, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
			pow10tab[i] = pow10tab[m] * pow10tab[(i - m >> 0)];
			i = i + 1 >> 0;
		}
	};
	return go$pkg;
})();
go$packages["unicode/utf8"] = (function() {
	var go$pkg = {};
	var decodeRuneInternal = function(p) {
		var r, size, short$1, n, _tuple, _slice, _index, c0, _tuple$1, _tuple$2, _tuple$3, _slice$1, _index$1, c1, _tuple$4, _tuple$5, _tuple$6, _tuple$7, _slice$2, _index$2, c2, _tuple$8, _tuple$9, _tuple$10, _tuple$11, _tuple$12, _slice$3, _index$3, c3, _tuple$13, _tuple$14, _tuple$15, _tuple$16;
		r = 0;
		size = 0;
		short$1 = false;
		n = p.length;
		if (n < 1) {
			_tuple = [65533, 0, true], r = _tuple[0], size = _tuple[1], short$1 = _tuple[2];
			return [r, size, short$1];
		}
		c0 = (_slice = p, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range"));
		if (c0 < 128) {
			_tuple$1 = [(c0 >> 0), 1, false], r = _tuple$1[0], size = _tuple$1[1], short$1 = _tuple$1[2];
			return [r, size, short$1];
		}
		if (c0 < 192) {
			_tuple$2 = [65533, 1, false], r = _tuple$2[0], size = _tuple$2[1], short$1 = _tuple$2[2];
			return [r, size, short$1];
		}
		if (n < 2) {
			_tuple$3 = [65533, 1, true], r = _tuple$3[0], size = _tuple$3[1], short$1 = _tuple$3[2];
			return [r, size, short$1];
		}
		c1 = (_slice$1 = p, _index$1 = 1, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range"));
		if (c1 < 128 || 192 <= c1) {
			_tuple$4 = [65533, 1, false], r = _tuple$4[0], size = _tuple$4[1], short$1 = _tuple$4[2];
			return [r, size, short$1];
		}
		if (c0 < 224) {
			r = ((((c0 & 31) >>> 0) >> 0) << 6 >> 0) | (((c1 & 63) >>> 0) >> 0);
			if (r <= 127) {
				_tuple$5 = [65533, 1, false], r = _tuple$5[0], size = _tuple$5[1], short$1 = _tuple$5[2];
				return [r, size, short$1];
			}
			_tuple$6 = [r, 2, false], r = _tuple$6[0], size = _tuple$6[1], short$1 = _tuple$6[2];
			return [r, size, short$1];
		}
		if (n < 3) {
			_tuple$7 = [65533, 1, true], r = _tuple$7[0], size = _tuple$7[1], short$1 = _tuple$7[2];
			return [r, size, short$1];
		}
		c2 = (_slice$2 = p, _index$2 = 2, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range"));
		if (c2 < 128 || 192 <= c2) {
			_tuple$8 = [65533, 1, false], r = _tuple$8[0], size = _tuple$8[1], short$1 = _tuple$8[2];
			return [r, size, short$1];
		}
		if (c0 < 240) {
			r = (((((c0 & 15) >>> 0) >> 0) << 12 >> 0) | ((((c1 & 63) >>> 0) >> 0) << 6 >> 0)) | (((c2 & 63) >>> 0) >> 0);
			if (r <= 2047) {
				_tuple$9 = [65533, 1, false], r = _tuple$9[0], size = _tuple$9[1], short$1 = _tuple$9[2];
				return [r, size, short$1];
			}
			if (55296 <= r && r <= 57343) {
				_tuple$10 = [65533, 1, false], r = _tuple$10[0], size = _tuple$10[1], short$1 = _tuple$10[2];
				return [r, size, short$1];
			}
			_tuple$11 = [r, 3, false], r = _tuple$11[0], size = _tuple$11[1], short$1 = _tuple$11[2];
			return [r, size, short$1];
		}
		if (n < 4) {
			_tuple$12 = [65533, 1, true], r = _tuple$12[0], size = _tuple$12[1], short$1 = _tuple$12[2];
			return [r, size, short$1];
		}
		c3 = (_slice$3 = p, _index$3 = 3, (_index$3 >= 0 && _index$3 < _slice$3.length) ? _slice$3.array[_slice$3.offset + _index$3] : go$throwRuntimeError("index out of range"));
		if (c3 < 128 || 192 <= c3) {
			_tuple$13 = [65533, 1, false], r = _tuple$13[0], size = _tuple$13[1], short$1 = _tuple$13[2];
			return [r, size, short$1];
		}
		if (c0 < 248) {
			r = ((((((c0 & 7) >>> 0) >> 0) << 18 >> 0) | ((((c1 & 63) >>> 0) >> 0) << 12 >> 0)) | ((((c2 & 63) >>> 0) >> 0) << 6 >> 0)) | (((c3 & 63) >>> 0) >> 0);
			if (r <= 65535 || 1114111 < r) {
				_tuple$14 = [65533, 1, false], r = _tuple$14[0], size = _tuple$14[1], short$1 = _tuple$14[2];
				return [r, size, short$1];
			}
			_tuple$15 = [r, 4, false], r = _tuple$15[0], size = _tuple$15[1], short$1 = _tuple$15[2];
			return [r, size, short$1];
		}
		_tuple$16 = [65533, 1, false], r = _tuple$16[0], size = _tuple$16[1], short$1 = _tuple$16[2];
		return [r, size, short$1];
	};
	var decodeRuneInStringInternal = function(s) {
		var r, size, short$1, n, _tuple, c0, _tuple$1, _tuple$2, _tuple$3, c1, _tuple$4, _tuple$5, _tuple$6, _tuple$7, c2, _tuple$8, _tuple$9, _tuple$10, _tuple$11, _tuple$12, c3, _tuple$13, _tuple$14, _tuple$15, _tuple$16;
		r = 0;
		size = 0;
		short$1 = false;
		n = s.length;
		if (n < 1) {
			_tuple = [65533, 0, true], r = _tuple[0], size = _tuple[1], short$1 = _tuple[2];
			return [r, size, short$1];
		}
		c0 = s.charCodeAt(0);
		if (c0 < 128) {
			_tuple$1 = [(c0 >> 0), 1, false], r = _tuple$1[0], size = _tuple$1[1], short$1 = _tuple$1[2];
			return [r, size, short$1];
		}
		if (c0 < 192) {
			_tuple$2 = [65533, 1, false], r = _tuple$2[0], size = _tuple$2[1], short$1 = _tuple$2[2];
			return [r, size, short$1];
		}
		if (n < 2) {
			_tuple$3 = [65533, 1, true], r = _tuple$3[0], size = _tuple$3[1], short$1 = _tuple$3[2];
			return [r, size, short$1];
		}
		c1 = s.charCodeAt(1);
		if (c1 < 128 || 192 <= c1) {
			_tuple$4 = [65533, 1, false], r = _tuple$4[0], size = _tuple$4[1], short$1 = _tuple$4[2];
			return [r, size, short$1];
		}
		if (c0 < 224) {
			r = ((((c0 & 31) >>> 0) >> 0) << 6 >> 0) | (((c1 & 63) >>> 0) >> 0);
			if (r <= 127) {
				_tuple$5 = [65533, 1, false], r = _tuple$5[0], size = _tuple$5[1], short$1 = _tuple$5[2];
				return [r, size, short$1];
			}
			_tuple$6 = [r, 2, false], r = _tuple$6[0], size = _tuple$6[1], short$1 = _tuple$6[2];
			return [r, size, short$1];
		}
		if (n < 3) {
			_tuple$7 = [65533, 1, true], r = _tuple$7[0], size = _tuple$7[1], short$1 = _tuple$7[2];
			return [r, size, short$1];
		}
		c2 = s.charCodeAt(2);
		if (c2 < 128 || 192 <= c2) {
			_tuple$8 = [65533, 1, false], r = _tuple$8[0], size = _tuple$8[1], short$1 = _tuple$8[2];
			return [r, size, short$1];
		}
		if (c0 < 240) {
			r = (((((c0 & 15) >>> 0) >> 0) << 12 >> 0) | ((((c1 & 63) >>> 0) >> 0) << 6 >> 0)) | (((c2 & 63) >>> 0) >> 0);
			if (r <= 2047) {
				_tuple$9 = [65533, 1, false], r = _tuple$9[0], size = _tuple$9[1], short$1 = _tuple$9[2];
				return [r, size, short$1];
			}
			if (55296 <= r && r <= 57343) {
				_tuple$10 = [65533, 1, false], r = _tuple$10[0], size = _tuple$10[1], short$1 = _tuple$10[2];
				return [r, size, short$1];
			}
			_tuple$11 = [r, 3, false], r = _tuple$11[0], size = _tuple$11[1], short$1 = _tuple$11[2];
			return [r, size, short$1];
		}
		if (n < 4) {
			_tuple$12 = [65533, 1, true], r = _tuple$12[0], size = _tuple$12[1], short$1 = _tuple$12[2];
			return [r, size, short$1];
		}
		c3 = s.charCodeAt(3);
		if (c3 < 128 || 192 <= c3) {
			_tuple$13 = [65533, 1, false], r = _tuple$13[0], size = _tuple$13[1], short$1 = _tuple$13[2];
			return [r, size, short$1];
		}
		if (c0 < 248) {
			r = ((((((c0 & 7) >>> 0) >> 0) << 18 >> 0) | ((((c1 & 63) >>> 0) >> 0) << 12 >> 0)) | ((((c2 & 63) >>> 0) >> 0) << 6 >> 0)) | (((c3 & 63) >>> 0) >> 0);
			if (r <= 65535 || 1114111 < r) {
				_tuple$14 = [65533, 1, false], r = _tuple$14[0], size = _tuple$14[1], short$1 = _tuple$14[2];
				return [r, size, short$1];
			}
			_tuple$15 = [r, 4, false], r = _tuple$15[0], size = _tuple$15[1], short$1 = _tuple$15[2];
			return [r, size, short$1];
		}
		_tuple$16 = [65533, 1, false], r = _tuple$16[0], size = _tuple$16[1], short$1 = _tuple$16[2];
		return [r, size, short$1];
	};
	var FullRune = go$pkg.FullRune = function(p) {
		var _tuple, short$1;
		_tuple = decodeRuneInternal(p), short$1 = _tuple[2];
		return !short$1;
	};
	var FullRuneInString = go$pkg.FullRuneInString = function(s) {
		var _tuple, short$1;
		_tuple = decodeRuneInStringInternal(s), short$1 = _tuple[2];
		return !short$1;
	};
	var DecodeRune = go$pkg.DecodeRune = function(p) {
		var r, size, _tuple;
		r = 0;
		size = 0;
		_tuple = decodeRuneInternal(p), r = _tuple[0], size = _tuple[1];
		return [r, size];
	};
	var DecodeRuneInString = go$pkg.DecodeRuneInString = function(s) {
		var r, size, _tuple;
		r = 0;
		size = 0;
		_tuple = decodeRuneInStringInternal(s), r = _tuple[0], size = _tuple[1];
		return [r, size];
	};
	var DecodeLastRune = go$pkg.DecodeLastRune = function(p) {
		var r, size, end, _tuple, start, _slice, _index, _tuple$1, lim, _slice$1, _index$1, _tuple$2, _tuple$3, _tuple$4;
		r = 0;
		size = 0;
		end = p.length;
		if (end === 0) {
			_tuple = [65533, 0], r = _tuple[0], size = _tuple[1];
			return [r, size];
		}
		start = end - 1 >> 0;
		r = ((_slice = p, _index = start, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) >> 0);
		if (r < 128) {
			_tuple$1 = [r, 1], r = _tuple$1[0], size = _tuple$1[1];
			return [r, size];
		}
		lim = end - 4 >> 0;
		if (lim < 0) {
			lim = 0;
		}
		start = start - 1 >> 0;
		while (start >= lim) {
			if (RuneStart((_slice$1 = p, _index$1 = start, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")))) {
				break;
			}
			start = start - 1 >> 0;
		}
		if (start < 0) {
			start = 0;
		}
		_tuple$2 = DecodeRune(go$subslice(p, start, end)), r = _tuple$2[0], size = _tuple$2[1];
		if (!(((start + size >> 0) === end))) {
			_tuple$3 = [65533, 1], r = _tuple$3[0], size = _tuple$3[1];
			return [r, size];
		}
		_tuple$4 = [r, size], r = _tuple$4[0], size = _tuple$4[1];
		return [r, size];
	};
	var DecodeLastRuneInString = go$pkg.DecodeLastRuneInString = function(s) {
		var r, size, end, _tuple, start, _tuple$1, lim, _tuple$2, _tuple$3, _tuple$4;
		r = 0;
		size = 0;
		end = s.length;
		if (end === 0) {
			_tuple = [65533, 0], r = _tuple[0], size = _tuple[1];
			return [r, size];
		}
		start = end - 1 >> 0;
		r = (s.charCodeAt(start) >> 0);
		if (r < 128) {
			_tuple$1 = [r, 1], r = _tuple$1[0], size = _tuple$1[1];
			return [r, size];
		}
		lim = end - 4 >> 0;
		if (lim < 0) {
			lim = 0;
		}
		start = start - 1 >> 0;
		while (start >= lim) {
			if (RuneStart(s.charCodeAt(start))) {
				break;
			}
			start = start - 1 >> 0;
		}
		if (start < 0) {
			start = 0;
		}
		_tuple$2 = DecodeRuneInString(s.substring(start, end)), r = _tuple$2[0], size = _tuple$2[1];
		if (!(((start + size >> 0) === end))) {
			_tuple$3 = [65533, 1], r = _tuple$3[0], size = _tuple$3[1];
			return [r, size];
		}
		_tuple$4 = [r, size], r = _tuple$4[0], size = _tuple$4[1];
		return [r, size];
	};
	var RuneLen = go$pkg.RuneLen = function(r) {
		if (r < 0) {
			return -1;
		} else if (r <= 127) {
			return 1;
		} else if (r <= 2047) {
			return 2;
		} else if (55296 <= r && r <= 57343) {
			return -1;
		} else if (r <= 65535) {
			return 3;
		} else if (r <= 1114111) {
			return 4;
		}
		return -1;
	};
	var EncodeRune = go$pkg.EncodeRune = function(p, r) {
		var _slice, _index, _slice$1, _index$1, _slice$2, _index$2, _slice$3, _index$3, _slice$4, _index$4, _slice$5, _index$5, _slice$6, _index$6, _slice$7, _index$7, _slice$8, _index$8, _slice$9, _index$9;
		if ((r >>> 0) <= 127) {
			_slice = p, _index = 0, (_index >= 0 && _index < _slice.length) ? (_slice.array[_slice.offset + _index] = (r << 24 >>> 24)) : go$throwRuntimeError("index out of range");
			return 1;
		}
		if ((r >>> 0) <= 2047) {
			_slice$1 = p, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = (192 | ((r >> 6 >> 0) << 24 >>> 24)) >>> 0) : go$throwRuntimeError("index out of range");
			_slice$2 = p, _index$2 = 1, (_index$2 >= 0 && _index$2 < _slice$2.length) ? (_slice$2.array[_slice$2.offset + _index$2] = (128 | (((r << 24 >>> 24) & 63) >>> 0)) >>> 0) : go$throwRuntimeError("index out of range");
			return 2;
		}
		if ((r >>> 0) > 1114111) {
			r = 65533;
		}
		if (55296 <= r && r <= 57343) {
			r = 65533;
		}
		if ((r >>> 0) <= 65535) {
			_slice$3 = p, _index$3 = 0, (_index$3 >= 0 && _index$3 < _slice$3.length) ? (_slice$3.array[_slice$3.offset + _index$3] = (224 | ((r >> 12 >> 0) << 24 >>> 24)) >>> 0) : go$throwRuntimeError("index out of range");
			_slice$4 = p, _index$4 = 1, (_index$4 >= 0 && _index$4 < _slice$4.length) ? (_slice$4.array[_slice$4.offset + _index$4] = (128 | ((((r >> 6 >> 0) << 24 >>> 24) & 63) >>> 0)) >>> 0) : go$throwRuntimeError("index out of range");
			_slice$5 = p, _index$5 = 2, (_index$5 >= 0 && _index$5 < _slice$5.length) ? (_slice$5.array[_slice$5.offset + _index$5] = (128 | (((r << 24 >>> 24) & 63) >>> 0)) >>> 0) : go$throwRuntimeError("index out of range");
			return 3;
		}
		_slice$6 = p, _index$6 = 0, (_index$6 >= 0 && _index$6 < _slice$6.length) ? (_slice$6.array[_slice$6.offset + _index$6] = (240 | ((r >> 18 >> 0) << 24 >>> 24)) >>> 0) : go$throwRuntimeError("index out of range");
		_slice$7 = p, _index$7 = 1, (_index$7 >= 0 && _index$7 < _slice$7.length) ? (_slice$7.array[_slice$7.offset + _index$7] = (128 | ((((r >> 12 >> 0) << 24 >>> 24) & 63) >>> 0)) >>> 0) : go$throwRuntimeError("index out of range");
		_slice$8 = p, _index$8 = 2, (_index$8 >= 0 && _index$8 < _slice$8.length) ? (_slice$8.array[_slice$8.offset + _index$8] = (128 | ((((r >> 6 >> 0) << 24 >>> 24) & 63) >>> 0)) >>> 0) : go$throwRuntimeError("index out of range");
		_slice$9 = p, _index$9 = 3, (_index$9 >= 0 && _index$9 < _slice$9.length) ? (_slice$9.array[_slice$9.offset + _index$9] = (128 | (((r << 24 >>> 24) & 63) >>> 0)) >>> 0) : go$throwRuntimeError("index out of range");
		return 4;
	};
	var RuneCount = go$pkg.RuneCount = function(p) {
		var i, n, _slice, _index, _tuple, size;
		i = 0;
		n = 0;
		n = 0;
		while (i < p.length) {
			if ((_slice = p, _index = i, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) < 128) {
				i = i + 1 >> 0;
			} else {
				_tuple = DecodeRune(go$subslice(p, i)), size = _tuple[1];
				i = i + (size) >> 0;
			}
			n = n + 1 >> 0;
		}
		return n;
	};
	var RuneCountInString = go$pkg.RuneCountInString = function(s) {
		var n, _ref, _i, _rune;
		n = 0;
		_ref = s;
		_i = 0;
		while (_i < _ref.length) {
			_rune = go$decodeRune(_ref, _i);
			n = n + 1 >> 0;
			_i += _rune[1];
		}
		return n;
	};
	var RuneStart = go$pkg.RuneStart = function(b) {
		return !((((b & 192) >>> 0) === 128));
	};
	var Valid = go$pkg.Valid = function(p) {
		var i, _slice, _index, _tuple, size;
		i = 0;
		while (i < p.length) {
			if ((_slice = p, _index = i, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) < 128) {
				i = i + 1 >> 0;
			} else {
				_tuple = DecodeRune(go$subslice(p, i)), size = _tuple[1];
				if (size === 1) {
					return false;
				}
				i = i + (size) >> 0;
			}
		}
		return true;
	};
	var ValidString = go$pkg.ValidString = function(s) {
		var _ref, _i, _rune, r, i, _tuple, size;
		_ref = s;
		_i = 0;
		while (_i < _ref.length) {
			_rune = go$decodeRune(_ref, _i);
			r = _rune[0];
			i = _i;
			if (r === 65533) {
				_tuple = DecodeRuneInString(s.substring(i)), size = _tuple[1];
				if (size === 1) {
					return false;
				}
			}
			_i += _rune[1];
		}
		return true;
	};
	var ValidRune = go$pkg.ValidRune = function(r) {
		if (r < 0) {
			return false;
		} else if (55296 <= r && r <= 57343) {
			return false;
		} else if (r > 1114111) {
			return false;
		}
		return true;
	};
	go$pkg.init = function() {
	};
	return go$pkg;
})();
go$packages["strconv"] = (function() {
	var go$pkg = {};
	var math = go$packages["math"];
	var errors = go$packages["errors"];
	var utf8 = go$packages["unicode/utf8"];
	var NumError;
	NumError = go$newType(0, "Struct", "strconv.NumError", "NumError", "strconv", function(Func_, Num_, Err_) {
		this.go$val = this;
		this.Func = Func_ !== undefined ? Func_ : "";
		this.Num = Num_ !== undefined ? Num_ : "";
		this.Err = Err_ !== undefined ? Err_ : null;
	});
	go$pkg.NumError = NumError;
	var decimal;
	decimal = go$newType(0, "Struct", "strconv.decimal", "decimal", "strconv", function(d_, nd_, dp_, neg_, trunc_) {
		this.go$val = this;
		this.d = d_ !== undefined ? d_ : go$makeNativeArray("Uint8", 800, function() { return 0; });
		this.nd = nd_ !== undefined ? nd_ : 0;
		this.dp = dp_ !== undefined ? dp_ : 0;
		this.neg = neg_ !== undefined ? neg_ : false;
		this.trunc = trunc_ !== undefined ? trunc_ : false;
	});
	go$pkg.decimal = decimal;
	var leftCheat;
	leftCheat = go$newType(0, "Struct", "strconv.leftCheat", "leftCheat", "strconv", function(delta_, cutoff_) {
		this.go$val = this;
		this.delta = delta_ !== undefined ? delta_ : 0;
		this.cutoff = cutoff_ !== undefined ? cutoff_ : "";
	});
	go$pkg.leftCheat = leftCheat;
	var extFloat;
	extFloat = go$newType(0, "Struct", "strconv.extFloat", "extFloat", "strconv", function(mant_, exp_, neg_) {
		this.go$val = this;
		this.mant = mant_ !== undefined ? mant_ : new Go$Uint64(0, 0);
		this.exp = exp_ !== undefined ? exp_ : 0;
		this.neg = neg_ !== undefined ? neg_ : false;
	});
	go$pkg.extFloat = extFloat;
	var floatInfo;
	floatInfo = go$newType(0, "Struct", "strconv.floatInfo", "floatInfo", "strconv", function(mantbits_, expbits_, bias_) {
		this.go$val = this;
		this.mantbits = mantbits_ !== undefined ? mantbits_ : 0;
		this.expbits = expbits_ !== undefined ? expbits_ : 0;
		this.bias = bias_ !== undefined ? bias_ : 0;
	});
	go$pkg.floatInfo = floatInfo;
	var decimalSlice;
	decimalSlice = go$newType(0, "Struct", "strconv.decimalSlice", "decimalSlice", "strconv", function(d_, nd_, dp_, neg_) {
		this.go$val = this;
		this.d = d_ !== undefined ? d_ : (go$sliceType(Go$Uint8)).nil;
		this.nd = nd_ !== undefined ? nd_ : 0;
		this.dp = dp_ !== undefined ? dp_ : 0;
		this.neg = neg_ !== undefined ? neg_ : false;
	});
	go$pkg.decimalSlice = decimalSlice;
	NumError.init([["Func", "", Go$String, ""], ["Num", "", Go$String, ""], ["Err", "", go$error, ""]]);
	(go$ptrType(NumError)).methods = [["Error", "", [], [Go$String], false]];
	decimal.init([["d", "strconv", (go$arrayType(Go$Uint8, 800)), ""], ["nd", "strconv", Go$Int, ""], ["dp", "strconv", Go$Int, ""], ["neg", "strconv", Go$Bool, ""], ["trunc", "strconv", Go$Bool, ""]]);
	(go$ptrType(decimal)).methods = [["Assign", "", [Go$Uint64], [], false], ["Round", "", [Go$Int], [], false], ["RoundDown", "", [Go$Int], [], false], ["RoundUp", "", [Go$Int], [], false], ["RoundedInteger", "", [], [Go$Uint64], false], ["Shift", "", [Go$Int], [], false], ["String", "", [], [Go$String], false], ["atof32int", "strconv", [], [Go$Float32], false], ["floatBits", "strconv", [(go$ptrType(floatInfo))], [Go$Uint64, Go$Bool], false], ["set", "strconv", [Go$String], [Go$Bool], false]];
	leftCheat.init([["delta", "strconv", Go$Int, ""], ["cutoff", "strconv", Go$String, ""]]);
	extFloat.init([["mant", "strconv", Go$Uint64, ""], ["exp", "strconv", Go$Int, ""], ["neg", "strconv", Go$Bool, ""]]);
	(go$ptrType(extFloat)).methods = [["AssignComputeBounds", "", [Go$Uint64, Go$Int, Go$Bool, (go$ptrType(floatInfo))], [extFloat, extFloat], false], ["AssignDecimal", "", [Go$Uint64, Go$Int, Go$Bool, Go$Bool, (go$ptrType(floatInfo))], [Go$Bool], false], ["FixedDecimal", "", [(go$ptrType(decimalSlice)), Go$Int], [Go$Bool], false], ["Multiply", "", [extFloat], [], false], ["Normalize", "", [], [Go$Uint], false], ["ShortestDecimal", "", [(go$ptrType(decimalSlice)), (go$ptrType(extFloat)), (go$ptrType(extFloat))], [Go$Bool], false], ["floatBits", "strconv", [(go$ptrType(floatInfo))], [Go$Uint64, Go$Bool], false], ["frexp10", "strconv", [], [Go$Int, Go$Int], false]];
	floatInfo.init([["mantbits", "strconv", Go$Uint, ""], ["expbits", "strconv", Go$Uint, ""], ["bias", "strconv", Go$Int, ""]]);
	decimalSlice.init([["d", "strconv", (go$sliceType(Go$Uint8)), ""], ["nd", "strconv", Go$Int, ""], ["dp", "strconv", Go$Int, ""], ["neg", "strconv", Go$Bool, ""]]);
	var optimize, powtab, float64pow10, float32pow10, leftcheats, smallPowersOfTen, powersOfTen, uint64pow10, float32info, float64info, isPrint16, isNotPrint16, isPrint32, isNotPrint32, shifts;
	var ParseBool = go$pkg.ParseBool = function(str) {
		var value, err, _ref, _tuple, _tuple$1, _tuple$2;
		value = false;
		err = null;
		_ref = str;
		if (_ref === "1" || _ref === "t" || _ref === "T" || _ref === "true" || _ref === "TRUE" || _ref === "True") {
			_tuple = [true, null], value = _tuple[0], err = _tuple[1];
			return [value, err];
		} else if (_ref === "0" || _ref === "f" || _ref === "F" || _ref === "false" || _ref === "FALSE" || _ref === "False") {
			_tuple$1 = [false, null], value = _tuple$1[0], err = _tuple$1[1];
			return [value, err];
		}
		_tuple$2 = [false, syntaxError("ParseBool", str)], value = _tuple$2[0], err = _tuple$2[1];
		return [value, err];
	};
	var FormatBool = go$pkg.FormatBool = function(b) {
		if (b) {
			return "true";
		}
		return "false";
	};
	var AppendBool = go$pkg.AppendBool = function(dst, b) {
		if (b) {
			return go$appendSlice(dst, new (go$sliceType(Go$Uint8))(go$stringToBytes("true")));
		}
		return go$appendSlice(dst, new (go$sliceType(Go$Uint8))(go$stringToBytes("false")));
	};
	var equalIgnoreCase = function(s1, s2) {
		var i, c1, c2;
		if (!((s1.length === s2.length))) {
			return false;
		}
		i = 0;
		while (i < s1.length) {
			c1 = s1.charCodeAt(i);
			if (65 <= c1 && c1 <= 90) {
				c1 = c1 + 32 << 24 >>> 24;
			}
			c2 = s2.charCodeAt(i);
			if (65 <= c2 && c2 <= 90) {
				c2 = c2 + 32 << 24 >>> 24;
			}
			if (!((c1 === c2))) {
				return false;
			}
			i = i + 1 >> 0;
		}
		return true;
	};
	var special = function(s) {
		var f, ok, _ref, _tuple, _tuple$1, _tuple$2, _tuple$3;
		f = 0;
		ok = false;
		if (s.length === 0) {
			return [f, ok];
		}
		_ref = s.charCodeAt(0);
		if (_ref === 43) {
			if (equalIgnoreCase(s, "+inf") || equalIgnoreCase(s, "+infinity")) {
				_tuple = [math.Inf(1), true], f = _tuple[0], ok = _tuple[1];
				return [f, ok];
			}
		} else if (_ref === 45) {
			if (equalIgnoreCase(s, "-inf") || equalIgnoreCase(s, "-infinity")) {
				_tuple$1 = [math.Inf(-1), true], f = _tuple$1[0], ok = _tuple$1[1];
				return [f, ok];
			}
		} else if (_ref === 110 || _ref === 78) {
			if (equalIgnoreCase(s, "nan")) {
				_tuple$2 = [math.NaN(), true], f = _tuple$2[0], ok = _tuple$2[1];
				return [f, ok];
			}
		} else if (_ref === 105 || _ref === 73) {
			if (equalIgnoreCase(s, "inf") || equalIgnoreCase(s, "infinity")) {
				_tuple$3 = [math.Inf(1), true], f = _tuple$3[0], ok = _tuple$3[1];
				return [f, ok];
			}
		} else {
			return [f, ok];
		}
		return [f, ok];
	};
	decimal.Ptr.prototype.set = function(s) {
		var ok, b, i, sawdot, sawdigits, esign, e, x;
		ok = false;
		b = this;
		i = 0;
		b.neg = false;
		b.trunc = false;
		if (i >= s.length) {
			return ok;
		}
		if (s.charCodeAt(i) === 43) {
			i = i + 1 >> 0;
		} else if (s.charCodeAt(i) === 45) {
			b.neg = true;
			i = i + 1 >> 0;
		}
		sawdot = false;
		sawdigits = false;
		while (i < s.length) {
			if (s.charCodeAt(i) === 46) {
				if (sawdot) {
					return ok;
				}
				sawdot = true;
				b.dp = b.nd;
				i = i + 1 >> 0;
				continue;
			} else if (48 <= s.charCodeAt(i) && s.charCodeAt(i) <= 57) {
				sawdigits = true;
				if ((s.charCodeAt(i) === 48) && (b.nd === 0)) {
					b.dp = b.dp - 1 >> 0;
					i = i + 1 >> 0;
					continue;
				}
				if (b.nd < 800) {
					b.d[b.nd] = s.charCodeAt(i);
					b.nd = b.nd + 1 >> 0;
				} else if (!((s.charCodeAt(i) === 48))) {
					b.trunc = true;
				}
				i = i + 1 >> 0;
				continue;
			}
			break;
		}
		if (!sawdigits) {
			return ok;
		}
		if (!sawdot) {
			b.dp = b.nd;
		}
		if (i < s.length && ((s.charCodeAt(i) === 101) || (s.charCodeAt(i) === 69))) {
			i = i + 1 >> 0;
			if (i >= s.length) {
				return ok;
			}
			esign = 1;
			if (s.charCodeAt(i) === 43) {
				i = i + 1 >> 0;
			} else if (s.charCodeAt(i) === 45) {
				i = i + 1 >> 0;
				esign = -1;
			}
			if (i >= s.length || s.charCodeAt(i) < 48 || s.charCodeAt(i) > 57) {
				return ok;
			}
			e = 0;
			while (i < s.length && 48 <= s.charCodeAt(i) && s.charCodeAt(i) <= 57) {
				if (e < 10000) {
					e = ((x = 10, (((e >>> 16 << 16) * x >> 0) + (e << 16 >>> 16) * x) >> 0) + (s.charCodeAt(i) >> 0) >> 0) - 48 >> 0;
				}
				i = i + 1 >> 0;
			}
			b.dp = b.dp + (((((e >>> 16 << 16) * esign >> 0) + (e << 16 >>> 16) * esign) >> 0)) >> 0;
		}
		if (!((i === s.length))) {
			return ok;
		}
		ok = true;
		return ok;
	};
	decimal.prototype.set = function(s) { return this.go$val.set(s); };
	var readFloat = function(s) {
		var mantissa, exp, neg, trunc, ok, i, sawdot, sawdigits, nd, ndMant, dp, c, _ref, x, esign, e, x$1;
		mantissa = new Go$Uint64(0, 0);
		exp = 0;
		neg = false;
		trunc = false;
		ok = false;
		i = 0;
		if (i >= s.length) {
			return [mantissa, exp, neg, trunc, ok];
		}
		if (s.charCodeAt(i) === 43) {
			i = i + 1 >> 0;
		} else if (s.charCodeAt(i) === 45) {
			neg = true;
			i = i + 1 >> 0;
		}
		sawdot = false;
		sawdigits = false;
		nd = 0;
		ndMant = 0;
		dp = 0;
		while (i < s.length) {
			c = s.charCodeAt(i);
			_ref = true;
			if (_ref === (c === 46)) {
				if (sawdot) {
					return [mantissa, exp, neg, trunc, ok];
				}
				sawdot = true;
				dp = nd;
				i = i + 1 >> 0;
				continue;
			} else if (_ref === 48 <= c && c <= 57) {
				sawdigits = true;
				if ((c === 48) && (nd === 0)) {
					dp = dp - 1 >> 0;
					i = i + 1 >> 0;
					continue;
				}
				nd = nd + 1 >> 0;
				if (ndMant < 19) {
					mantissa = go$mul64(mantissa, new Go$Uint64(0, 10));
					mantissa = (x = new Go$Uint64(0, (c - 48 << 24 >>> 24)), new Go$Uint64(mantissa.high + x.high, mantissa.low + x.low));
					ndMant = ndMant + 1 >> 0;
				} else if (!((s.charCodeAt(i) === 48))) {
					trunc = true;
				}
				i = i + 1 >> 0;
				continue;
			}
			break;
		}
		if (!sawdigits) {
			return [mantissa, exp, neg, trunc, ok];
		}
		if (!sawdot) {
			dp = nd;
		}
		if (i < s.length && ((s.charCodeAt(i) === 101) || (s.charCodeAt(i) === 69))) {
			i = i + 1 >> 0;
			if (i >= s.length) {
				return [mantissa, exp, neg, trunc, ok];
			}
			esign = 1;
			if (s.charCodeAt(i) === 43) {
				i = i + 1 >> 0;
			} else if (s.charCodeAt(i) === 45) {
				i = i + 1 >> 0;
				esign = -1;
			}
			if (i >= s.length || s.charCodeAt(i) < 48 || s.charCodeAt(i) > 57) {
				return [mantissa, exp, neg, trunc, ok];
			}
			e = 0;
			while (i < s.length && 48 <= s.charCodeAt(i) && s.charCodeAt(i) <= 57) {
				if (e < 10000) {
					e = ((x$1 = 10, (((e >>> 16 << 16) * x$1 >> 0) + (e << 16 >>> 16) * x$1) >> 0) + (s.charCodeAt(i) >> 0) >> 0) - 48 >> 0;
				}
				i = i + 1 >> 0;
			}
			dp = dp + (((((e >>> 16 << 16) * esign >> 0) + (e << 16 >>> 16) * esign) >> 0)) >> 0;
		}
		if (!((i === s.length))) {
			return [mantissa, exp, neg, trunc, ok];
		}
		exp = dp - ndMant >> 0;
		ok = true;
		return [mantissa, exp, neg, trunc, ok];
	};
	decimal.Ptr.prototype.floatBits = function(flt) {
		var go$this = this, b, overflow, d, exp, mant, n, _slice, _index, n$1, _slice$1, _index$1, n$2, y, x, y$1, x$1, x$2, y$2, x$3, x$4, bits, x$5, y$3, x$6, _tuple;
		b = new Go$Uint64(0, 0);
		overflow = false;
		/* */ var go$s = 0, go$f = function() { while (true) { switch (go$s) { case 0:
		d = go$this;
		exp = 0;
		mant = new Go$Uint64(0, 0);
		/* if (d.nd === 0) { */ if (d.nd === 0) {} else { go$s = 3; continue; }
			mant = new Go$Uint64(0, 0);
			exp = flt.bias;
			/* goto out */ go$s = 1; continue;
		/* } */ case 3:
		/* if (d.dp > 310) { */ if (d.dp > 310) {} else { go$s = 4; continue; }
			/* goto overflow */ go$s = 2; continue;
		/* } */ case 4:
		/* if (d.dp < -330) { */ if (d.dp < -330) {} else { go$s = 5; continue; }
			mant = new Go$Uint64(0, 0);
			exp = flt.bias;
			/* goto out */ go$s = 1; continue;
		/* } */ case 5:
		exp = 0;
		while (d.dp > 0) {
			n = 0;
			if (d.dp >= powtab.length) {
				n = 27;
			} else {
				n = (_slice = powtab, _index = d.dp, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range"));
			}
			d.Shift(-n);
			exp = exp + (n) >> 0;
		}
		while (d.dp < 0 || (d.dp === 0) && d.d[0] < 53) {
			n$1 = 0;
			if (-d.dp >= powtab.length) {
				n$1 = 27;
			} else {
				n$1 = (_slice$1 = powtab, _index$1 = -d.dp, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range"));
			}
			d.Shift(n$1);
			exp = exp - (n$1) >> 0;
		}
		exp = exp - 1 >> 0;
		if (exp < (flt.bias + 1 >> 0)) {
			n$2 = (flt.bias + 1 >> 0) - exp >> 0;
			d.Shift(-n$2);
			exp = exp + (n$2) >> 0;
		}
		/* if ((exp - flt.bias >> 0) >= (((y = flt.expbits, y < 32 ? (1 << y) : 0) >> 0) - 1 >> 0)) { */ if ((exp - flt.bias >> 0) >= (((y = flt.expbits, y < 32 ? (1 << y) : 0) >> 0) - 1 >> 0)) {} else { go$s = 6; continue; }
			/* goto overflow */ go$s = 2; continue;
		/* } */ case 6:
		d.Shift(((1 + flt.mantbits >>> 0) >> 0));
		mant = d.RoundedInteger();
		/* if ((x = go$shiftLeft64(new Go$Uint64(0, 2), flt.mantbits), (mant.high === x.high && mant.low === x.low))) { */ if ((x = go$shiftLeft64(new Go$Uint64(0, 2), flt.mantbits), (mant.high === x.high && mant.low === x.low))) {} else { go$s = 7; continue; }
			mant = go$shiftRightUint64(mant, 1);
			exp = exp + 1 >> 0;
			/* if ((exp - flt.bias >> 0) >= (((y$1 = flt.expbits, y$1 < 32 ? (1 << y$1) : 0) >> 0) - 1 >> 0)) { */ if ((exp - flt.bias >> 0) >= (((y$1 = flt.expbits, y$1 < 32 ? (1 << y$1) : 0) >> 0) - 1 >> 0)) {} else { go$s = 8; continue; }
				/* goto overflow */ go$s = 2; continue;
			/* } */ case 8:
		/* } */ case 7:
		if ((x$1 = (x$2 = go$shiftLeft64(new Go$Uint64(0, 1), flt.mantbits), new Go$Uint64(mant.high & x$2.high, (mant.low & x$2.low) >>> 0)), (x$1.high === 0 && x$1.low === 0))) {
			exp = flt.bias;
		}
		/* goto out */ go$s = 1; continue;
		/* overflow: */ case 2:
		mant = new Go$Uint64(0, 0);
		exp = (((y$2 = flt.expbits, y$2 < 32 ? (1 << y$2) : 0) >> 0) - 1 >> 0) + flt.bias >> 0;
		overflow = true;
		/* out: */ case 1:
		bits = (x$3 = (x$4 = go$shiftLeft64(new Go$Uint64(0, 1), flt.mantbits), new Go$Uint64(x$4.high - 0, x$4.low - 1)), new Go$Uint64(mant.high & x$3.high, (mant.low & x$3.low) >>> 0));
		bits = (x$5 = go$shiftLeft64(new Go$Uint64(0, (((exp - flt.bias >> 0)) & ((((y$3 = flt.expbits, y$3 < 32 ? (1 << y$3) : 0) >> 0) - 1 >> 0)))), flt.mantbits), new Go$Uint64(bits.high | x$5.high, (bits.low | x$5.low) >>> 0));
		if (d.neg) {
			bits = (x$6 = go$shiftLeft64(go$shiftLeft64(new Go$Uint64(0, 1), flt.mantbits), flt.expbits), new Go$Uint64(bits.high | x$6.high, (bits.low | x$6.low) >>> 0));
		}
		_tuple = [bits, overflow], b = _tuple[0], overflow = _tuple[1];
		return [b, overflow];
		/* */ } break; } }; return go$f();
	};
	decimal.prototype.floatBits = function(flt) { return this.go$val.floatBits(flt); };
	decimal.Ptr.prototype.atof32int = function() {
		var d, f, i;
		d = this;
		f = 0;
		i = 0;
		while (i < d.nd) {
			f = f * 10 + (d.d[i] - 48 << 24 >>> 24);
			i = i + 1 >> 0;
		}
		if (d.neg) {
			f = -f;
		}
		return f;
	};
	decimal.prototype.atof32int = function() { return this.go$val.atof32int(); };
	var atof64exact = function(mantissa, exp, neg) {
		var f, ok, x, _tuple, _slice, _index, _slice$1, _index$1, _tuple$1, _slice$2, _index$2, _tuple$2;
		f = 0;
		ok = false;
		if (!((x = go$shiftRightUint64(mantissa, float64info.mantbits), (x.high === 0 && x.low === 0)))) {
			return [f, ok];
		}
		f = go$flatten64(mantissa);
		if (neg) {
			f = -f;
		}
		if (exp === 0) {
			_tuple = [f, true], f = _tuple[0], ok = _tuple[1];
			return [f, ok];
		} else if (exp > 0 && exp <= 37) {
			if (exp > 22) {
				f = f * ((_slice = float64pow10, _index = (exp - 22 >> 0), (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")));
				exp = 22;
			}
			if (f > 1e+15 || f < -1e+15) {
				return [f, ok];
			}
			_tuple$1 = [f * (_slice$1 = float64pow10, _index$1 = exp, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")), true], f = _tuple$1[0], ok = _tuple$1[1];
			return [f, ok];
		} else if (exp < 0 && exp >= -22) {
			_tuple$2 = [f / (_slice$2 = float64pow10, _index$2 = -exp, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")), true], f = _tuple$2[0], ok = _tuple$2[1];
			return [f, ok];
		}
		return [f, ok];
	};
	var atof32exact = function(mantissa, exp, neg) {
		var f, ok, x, _tuple, _slice, _index, _slice$1, _index$1, _tuple$1, _slice$2, _index$2, _tuple$2;
		f = 0;
		ok = false;
		if (!((x = go$shiftRightUint64(mantissa, float32info.mantbits), (x.high === 0 && x.low === 0)))) {
			return [f, ok];
		}
		f = go$flatten64(mantissa);
		if (neg) {
			f = -f;
		}
		if (exp === 0) {
			_tuple = [f, true], f = _tuple[0], ok = _tuple[1];
			return [f, ok];
		} else if (exp > 0 && exp <= 17) {
			if (exp > 10) {
				f = f * ((_slice = float32pow10, _index = (exp - 10 >> 0), (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")));
				exp = 10;
			}
			if (f > 1e+07 || f < -1e+07) {
				return [f, ok];
			}
			_tuple$1 = [f * (_slice$1 = float32pow10, _index$1 = exp, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")), true], f = _tuple$1[0], ok = _tuple$1[1];
			return [f, ok];
		} else if (exp < 0 && exp >= -10) {
			_tuple$2 = [f / (_slice$2 = float32pow10, _index$2 = -exp, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")), true], f = _tuple$2[0], ok = _tuple$2[1];
			return [f, ok];
		}
		return [f, ok];
	};
	var atof32 = function(s) {
		var f, err, ok, _tuple, val, _tuple$1, _tuple$2, mantissa, exp, neg, trunc, ok$1, ok$2, _tuple$3, f$1, _tuple$4, ext, ok$3, _tuple$5, b, ovf, _tuple$6, d, _tuple$7, _tuple$8, b$1, ovf$1, _tuple$9;
		f = 0;
		err = null;
		if (_tuple = special(s), val = _tuple[0], ok = _tuple[1], ok) {
			_tuple$1 = [val, null], f = _tuple$1[0], err = _tuple$1[1];
			return [f, err];
		}
		if (optimize) {
			_tuple$2 = readFloat(s), mantissa = _tuple$2[0], exp = _tuple$2[1], neg = _tuple$2[2], trunc = _tuple$2[3], ok$1 = _tuple$2[4];
			if (ok$1) {
				if (!trunc) {
					if (_tuple$3 = atof32exact(mantissa, exp, neg), f$1 = _tuple$3[0], ok$2 = _tuple$3[1], ok$2) {
						_tuple$4 = [f$1, null], f = _tuple$4[0], err = _tuple$4[1];
						return [f, err];
					}
				}
				ext = new extFloat.Ptr();
				if (ok$3 = ext.AssignDecimal(mantissa, exp, neg, trunc, float32info), ok$3) {
					_tuple$5 = ext.floatBits(float32info), b = _tuple$5[0], ovf = _tuple$5[1];
					f = math.Float32frombits((b.low >>> 0));
					if (ovf) {
						err = rangeError("ParseFloat", s);
					}
					_tuple$6 = [f, err], f = _tuple$6[0], err = _tuple$6[1];
					return [f, err];
				}
			}
		}
		d = new decimal.Ptr();
		if (!d.set(s)) {
			_tuple$7 = [0, syntaxError("ParseFloat", s)], f = _tuple$7[0], err = _tuple$7[1];
			return [f, err];
		}
		_tuple$8 = d.floatBits(float32info), b$1 = _tuple$8[0], ovf$1 = _tuple$8[1];
		f = math.Float32frombits((b$1.low >>> 0));
		if (ovf$1) {
			err = rangeError("ParseFloat", s);
		}
		_tuple$9 = [f, err], f = _tuple$9[0], err = _tuple$9[1];
		return [f, err];
	};
	var atof64 = function(s) {
		var f, err, ok, _tuple, val, _tuple$1, _tuple$2, mantissa, exp, neg, trunc, ok$1, ok$2, _tuple$3, f$1, _tuple$4, ext, ok$3, _tuple$5, b, ovf, _tuple$6, d, _tuple$7, _tuple$8, b$1, ovf$1, _tuple$9;
		f = 0;
		err = null;
		if (_tuple = special(s), val = _tuple[0], ok = _tuple[1], ok) {
			_tuple$1 = [val, null], f = _tuple$1[0], err = _tuple$1[1];
			return [f, err];
		}
		if (optimize) {
			_tuple$2 = readFloat(s), mantissa = _tuple$2[0], exp = _tuple$2[1], neg = _tuple$2[2], trunc = _tuple$2[3], ok$1 = _tuple$2[4];
			if (ok$1) {
				if (!trunc) {
					if (_tuple$3 = atof64exact(mantissa, exp, neg), f$1 = _tuple$3[0], ok$2 = _tuple$3[1], ok$2) {
						_tuple$4 = [f$1, null], f = _tuple$4[0], err = _tuple$4[1];
						return [f, err];
					}
				}
				ext = new extFloat.Ptr();
				if (ok$3 = ext.AssignDecimal(mantissa, exp, neg, trunc, float64info), ok$3) {
					_tuple$5 = ext.floatBits(float64info), b = _tuple$5[0], ovf = _tuple$5[1];
					f = math.Float64frombits(b);
					if (ovf) {
						err = rangeError("ParseFloat", s);
					}
					_tuple$6 = [f, err], f = _tuple$6[0], err = _tuple$6[1];
					return [f, err];
				}
			}
		}
		d = new decimal.Ptr();
		if (!d.set(s)) {
			_tuple$7 = [0, syntaxError("ParseFloat", s)], f = _tuple$7[0], err = _tuple$7[1];
			return [f, err];
		}
		_tuple$8 = d.floatBits(float64info), b$1 = _tuple$8[0], ovf$1 = _tuple$8[1];
		f = math.Float64frombits(b$1);
		if (ovf$1) {
			err = rangeError("ParseFloat", s);
		}
		_tuple$9 = [f, err], f = _tuple$9[0], err = _tuple$9[1];
		return [f, err];
	};
	var ParseFloat = go$pkg.ParseFloat = function(s, bitSize) {
		var f, err, _tuple, f1, err1, _tuple$1, _tuple$2, f1$1, err1$1, _tuple$3;
		f = 0;
		err = null;
		if (bitSize === 32) {
			_tuple = atof32(s), f1 = _tuple[0], err1 = _tuple[1];
			_tuple$1 = [f1, err1], f = _tuple$1[0], err = _tuple$1[1];
			return [f, err];
		}
		_tuple$2 = atof64(s), f1$1 = _tuple$2[0], err1$1 = _tuple$2[1];
		_tuple$3 = [f1$1, err1$1], f = _tuple$3[0], err = _tuple$3[1];
		return [f, err];
	};
	NumError.Ptr.prototype.Error = function() {
		var e;
		e = this;
		return "strconv." + e.Func + ": " + "parsing " + Quote(e.Num) + ": " + e.Err.Error();
	};
	NumError.prototype.Error = function() { return this.go$val.Error(); };
	var syntaxError = function(fn, str) {
		return new NumError.Ptr(fn, str, go$pkg.ErrSyntax);
	};
	var rangeError = function(fn, str) {
		return new NumError.Ptr(fn, str, go$pkg.ErrRange);
	};
	var cutoff64 = function(base) {
		var x;
		if (base < 2) {
			return new Go$Uint64(0, 0);
		}
		return (x = go$div64(new Go$Uint64(4294967295, 4294967295), new Go$Uint64(0, base), false), new Go$Uint64(x.high + 0, x.low + 1));
	};
	var ParseUint = go$pkg.ParseUint = function(s, base, bitSize) {
		var go$this = this, n, err, _tuple, cutoff, maxVal, s0, x, i, v, d, x$1, n1, _tuple$1, _tuple$2;
		n = new Go$Uint64(0, 0);
		err = null;
		/* */ var go$s = 0, go$f = function() { while (true) { switch (go$s) { case 0:
		_tuple = [new Go$Uint64(0, 0), new Go$Uint64(0, 0)], cutoff = _tuple[0], maxVal = _tuple[1];
		if (bitSize === 0) {
			bitSize = 32;
		}
		s0 = s;
		/* if (s.length < 1) { */ if (s.length < 1) {} else if (2 <= base && base <= 36) { go$s = 2; continue; } else if (base === 0) { go$s = 3; continue; } else { go$s = 4; continue; }
			err = go$pkg.ErrSyntax;
			/* goto Error */ go$s = 1; continue;
		/* } else if (2 <= base && base <= 36) { */ go$s = 5; continue; case 2: 
		/* } else if (base === 0) { */ go$s = 5; continue; case 3: 
			/* if ((s.charCodeAt(0) === 48) && s.length > 1 && ((s.charCodeAt(1) === 120) || (s.charCodeAt(1) === 88))) { */ if ((s.charCodeAt(0) === 48) && s.length > 1 && ((s.charCodeAt(1) === 120) || (s.charCodeAt(1) === 88))) {} else if (s.charCodeAt(0) === 48) { go$s = 6; continue; } else { go$s = 7; continue; }
				base = 16;
				s = s.substring(2);
				/* if (s.length < 1) { */ if (s.length < 1) {} else { go$s = 9; continue; }
					err = go$pkg.ErrSyntax;
					/* goto Error */ go$s = 1; continue;
				/* } */ case 9:
			/* } else if (s.charCodeAt(0) === 48) { */ go$s = 8; continue; case 6: 
				base = 8;
			/* } else { */ go$s = 8; continue; case 7: 
				base = 10;
			/* } */ case 8:
		/* } else { */ go$s = 5; continue; case 4: 
			err = errors.New("invalid base " + Itoa(base));
			/* goto Error */ go$s = 1; continue;
		/* } */ case 5:
		n = new Go$Uint64(0, 0);
		cutoff = cutoff64(base);
		maxVal = (x = go$shiftLeft64(new Go$Uint64(0, 1), (bitSize >>> 0)), new Go$Uint64(x.high - 0, x.low - 1));
		i = 0;
		/* while (i < s.length) { */ case 10: if(!(i < s.length)) { go$s = 11; continue; }
			v = 0;
			d = s.charCodeAt(i);
			/* if (48 <= d && d <= 57) { */ if (48 <= d && d <= 57) {} else if (97 <= d && d <= 122) { go$s = 12; continue; } else if (65 <= d && d <= 90) { go$s = 13; continue; } else { go$s = 14; continue; }
				v = d - 48 << 24 >>> 24;
			/* } else if (97 <= d && d <= 122) { */ go$s = 15; continue; case 12: 
				v = (d - 97 << 24 >>> 24) + 10 << 24 >>> 24;
			/* } else if (65 <= d && d <= 90) { */ go$s = 15; continue; case 13: 
				v = (d - 65 << 24 >>> 24) + 10 << 24 >>> 24;
			/* } else { */ go$s = 15; continue; case 14: 
				n = new Go$Uint64(0, 0);
				err = go$pkg.ErrSyntax;
				/* goto Error */ go$s = 1; continue;
			/* } */ case 15:
			/* if ((v >> 0) >= base) { */ if ((v >> 0) >= base) {} else { go$s = 16; continue; }
				n = new Go$Uint64(0, 0);
				err = go$pkg.ErrSyntax;
				/* goto Error */ go$s = 1; continue;
			/* } */ case 16:
			/* if ((n.high > cutoff.high || (n.high === cutoff.high && n.low >= cutoff.low))) { */ if ((n.high > cutoff.high || (n.high === cutoff.high && n.low >= cutoff.low))) {} else { go$s = 17; continue; }
				n = new Go$Uint64(4294967295, 4294967295);
				err = go$pkg.ErrRange;
				/* goto Error */ go$s = 1; continue;
			/* } */ case 17:
			n = go$mul64(n, (new Go$Uint64(0, base)));
			n1 = (x$1 = new Go$Uint64(0, v), new Go$Uint64(n.high + x$1.high, n.low + x$1.low));
			/* if ((n1.high < n.high || (n1.high === n.high && n1.low < n.low)) || (n1.high > maxVal.high || (n1.high === maxVal.high && n1.low > maxVal.low))) { */ if ((n1.high < n.high || (n1.high === n.high && n1.low < n.low)) || (n1.high > maxVal.high || (n1.high === maxVal.high && n1.low > maxVal.low))) {} else { go$s = 18; continue; }
				n = new Go$Uint64(4294967295, 4294967295);
				err = go$pkg.ErrRange;
				/* goto Error */ go$s = 1; continue;
			/* } */ case 18:
			n = n1;
			i = i + 1 >> 0;
		/* } */ go$s = 10; continue; case 11:
		_tuple$1 = [n, null], n = _tuple$1[0], err = _tuple$1[1];
		return [n, err];
		/* Error: */ case 1:
		_tuple$2 = [n, new NumError.Ptr("ParseUint", s0, err)], n = _tuple$2[0], err = _tuple$2[1];
		return [n, err];
		/* */ } break; } }; return go$f();
	};
	var ParseInt = go$pkg.ParseInt = function(s, base, bitSize) {
		var i, err, _tuple, s0, neg, un, _tuple$1, _tuple$2, cutoff, x, _tuple$3, x$1, _tuple$4, n, _tuple$5;
		i = new Go$Int64(0, 0);
		err = null;
		if (bitSize === 0) {
			bitSize = 32;
		}
		if (s.length === 0) {
			_tuple = [new Go$Int64(0, 0), syntaxError("ParseInt", s)], i = _tuple[0], err = _tuple[1];
			return [i, err];
		}
		s0 = s;
		neg = false;
		if (s.charCodeAt(0) === 43) {
			s = s.substring(1);
		} else if (s.charCodeAt(0) === 45) {
			neg = true;
			s = s.substring(1);
		}
		un = new Go$Uint64(0, 0);
		_tuple$1 = ParseUint(s, base, bitSize), un = _tuple$1[0], err = _tuple$1[1];
		if (!(go$interfaceIsEqual(err, null)) && !(go$interfaceIsEqual((err !== null && err.constructor === (go$ptrType(NumError)) ? err.go$val : go$typeAssertionFailed(err, (go$ptrType(NumError)))).Err, go$pkg.ErrRange))) {
			(err !== null && err.constructor === (go$ptrType(NumError)) ? err.go$val : go$typeAssertionFailed(err, (go$ptrType(NumError)))).Func = "ParseInt";
			(err !== null && err.constructor === (go$ptrType(NumError)) ? err.go$val : go$typeAssertionFailed(err, (go$ptrType(NumError)))).Num = s0;
			_tuple$2 = [new Go$Int64(0, 0), err], i = _tuple$2[0], err = _tuple$2[1];
			return [i, err];
		}
		cutoff = go$shiftLeft64(new Go$Uint64(0, 1), ((bitSize - 1 >> 0) >>> 0));
		if (!neg && (un.high > cutoff.high || (un.high === cutoff.high && un.low >= cutoff.low))) {
			_tuple$3 = [(x = new Go$Uint64(cutoff.high - 0, cutoff.low - 1), new Go$Int64(x.high, x.low)), rangeError("ParseInt", s0)], i = _tuple$3[0], err = _tuple$3[1];
			return [i, err];
		}
		if (neg && (un.high > cutoff.high || (un.high === cutoff.high && un.low > cutoff.low))) {
			_tuple$4 = [(x$1 = new Go$Int64(cutoff.high, cutoff.low), new Go$Int64(-x$1.high, -x$1.low)), rangeError("ParseInt", s0)], i = _tuple$4[0], err = _tuple$4[1];
			return [i, err];
		}
		n = new Go$Int64(un.high, un.low);
		if (neg) {
			n = new Go$Int64(-n.high, -n.low);
		}
		_tuple$5 = [n, null], i = _tuple$5[0], err = _tuple$5[1];
		return [i, err];
	};
	var Atoi = go$pkg.Atoi = function(s) {
		var i, err, _tuple, i64, _tuple$1;
		i = 0;
		err = null;
		_tuple = ParseInt(s, 10, 0), i64 = _tuple[0], err = _tuple[1];
		_tuple$1 = [((i64.low + ((i64.high >> 31) * 4294967296)) >> 0), err], i = _tuple$1[0], err = _tuple$1[1];
		return [i, err];
	};
	decimal.Ptr.prototype.String = function() {
		var a, n, buf, w, _slice, _index, _slice$1, _index$1, _slice$2, _index$2;
		a = this;
		n = 10 + a.nd >> 0;
		if (a.dp > 0) {
			n = n + (a.dp) >> 0;
		}
		if (a.dp < 0) {
			n = n + (-a.dp) >> 0;
		}
		buf = (go$sliceType(Go$Uint8)).make(n, 0, function() { return 0; });
		w = 0;
		if (a.nd === 0) {
			return "0";
		} else if (a.dp <= 0) {
			_slice = buf, _index = w, (_index >= 0 && _index < _slice.length) ? (_slice.array[_slice.offset + _index] = 48) : go$throwRuntimeError("index out of range");
			w = w + 1 >> 0;
			_slice$1 = buf, _index$1 = w, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = 46) : go$throwRuntimeError("index out of range");
			w = w + 1 >> 0;
			w = w + (digitZero(go$subslice(buf, w, (w + -a.dp >> 0)))) >> 0;
			w = w + (go$copySlice(go$subslice(buf, w), go$subslice(new (go$sliceType(Go$Uint8))(a.d), 0, a.nd))) >> 0;
		} else if (a.dp < a.nd) {
			w = w + (go$copySlice(go$subslice(buf, w), go$subslice(new (go$sliceType(Go$Uint8))(a.d), 0, a.dp))) >> 0;
			_slice$2 = buf, _index$2 = w, (_index$2 >= 0 && _index$2 < _slice$2.length) ? (_slice$2.array[_slice$2.offset + _index$2] = 46) : go$throwRuntimeError("index out of range");
			w = w + 1 >> 0;
			w = w + (go$copySlice(go$subslice(buf, w), go$subslice(new (go$sliceType(Go$Uint8))(a.d), a.dp, a.nd))) >> 0;
		} else {
			w = w + (go$copySlice(go$subslice(buf, w), go$subslice(new (go$sliceType(Go$Uint8))(a.d), 0, a.nd))) >> 0;
			w = w + (digitZero(go$subslice(buf, w, ((w + a.dp >> 0) - a.nd >> 0)))) >> 0;
		}
		return go$bytesToString(go$subslice(buf, 0, w));
	};
	decimal.prototype.String = function() { return this.go$val.String(); };
	var digitZero = function(dst) {
		var _ref, _i, i, _slice, _index;
		_ref = dst;
		_i = 0;
		while (_i < _ref.length) {
			i = _i;
			_slice = dst, _index = i, (_index >= 0 && _index < _slice.length) ? (_slice.array[_slice.offset + _index] = 48) : go$throwRuntimeError("index out of range");
			_i++;
		}
		return dst.length;
	};
	var trim = function(a) {
		while (a.nd > 0 && (a.d[(a.nd - 1 >> 0)] === 48)) {
			a.nd = a.nd - 1 >> 0;
		}
		if (a.nd === 0) {
			a.dp = 0;
		}
	};
	decimal.Ptr.prototype.Assign = function(v) {
		var a, buf, n, v1, x;
		a = this;
		buf = go$makeNativeArray("Uint8", 24, function() { return 0; });
		n = 0;
		while ((v.high > 0 || (v.high === 0 && v.low > 0))) {
			v1 = go$div64(v, new Go$Uint64(0, 10), false);
			v = (x = go$mul64(new Go$Uint64(0, 10), v1), new Go$Uint64(v.high - x.high, v.low - x.low));
			buf[n] = (new Go$Uint64(v.high + 0, v.low + 48).low << 24 >>> 24);
			n = n + 1 >> 0;
			v = v1;
		}
		a.nd = 0;
		n = n - 1 >> 0;
		while (n >= 0) {
			a.d[a.nd] = buf[n];
			a.nd = a.nd + 1 >> 0;
			n = n - 1 >> 0;
		}
		a.dp = a.nd;
		trim(a);
	};
	decimal.prototype.Assign = function(v) { return this.go$val.Assign(v); };
	var rightShift = function(a, k) {
		var r, w, n, x, c, x$1, c$1, dig, y, x$2, dig$1, y$1, x$3;
		r = 0;
		w = 0;
		n = 0;
		while (((n >> go$min(k, 31)) >> 0) === 0) {
			if (r >= a.nd) {
				if (n === 0) {
					a.nd = 0;
					return;
				}
				while (((n >> go$min(k, 31)) >> 0) === 0) {
					n = (x = 10, (((n >>> 16 << 16) * x >> 0) + (n << 16 >>> 16) * x) >> 0);
					r = r + 1 >> 0;
				}
				break;
			}
			c = (a.d[r] >> 0);
			n = ((x$1 = 10, (((n >>> 16 << 16) * x$1 >> 0) + (n << 16 >>> 16) * x$1) >> 0) + c >> 0) - 48 >> 0;
			r = r + 1 >> 0;
		}
		a.dp = a.dp - ((r - 1 >> 0)) >> 0;
		while (r < a.nd) {
			c$1 = (a.d[r] >> 0);
			dig = (n >> go$min(k, 31)) >> 0;
			n = n - (((y = k, y < 32 ? (dig << y) : 0) >> 0)) >> 0;
			a.d[w] = ((dig + 48 >> 0) << 24 >>> 24);
			w = w + 1 >> 0;
			n = ((x$2 = 10, (((n >>> 16 << 16) * x$2 >> 0) + (n << 16 >>> 16) * x$2) >> 0) + c$1 >> 0) - 48 >> 0;
			r = r + 1 >> 0;
		}
		while (n > 0) {
			dig$1 = (n >> go$min(k, 31)) >> 0;
			n = n - (((y$1 = k, y$1 < 32 ? (dig$1 << y$1) : 0) >> 0)) >> 0;
			if (w < 800) {
				a.d[w] = ((dig$1 + 48 >> 0) << 24 >>> 24);
				w = w + 1 >> 0;
			} else if (dig$1 > 0) {
				a.trunc = true;
			}
			n = (x$3 = 10, (((n >>> 16 << 16) * x$3 >> 0) + (n << 16 >>> 16) * x$3) >> 0);
		}
		a.nd = w;
		trim(a);
	};
	var prefixIsLessThan = function(b, s) {
		var i, _slice, _index, _slice$1, _index$1;
		i = 0;
		while (i < s.length) {
			if (i >= b.length) {
				return true;
			}
			if (!(((_slice = b, _index = i, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) === s.charCodeAt(i)))) {
				return (_slice$1 = b, _index$1 = i, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")) < s.charCodeAt(i);
			}
			i = i + 1 >> 0;
		}
		return false;
	};
	var leftShift = function(a, k) {
		var _slice, _index, delta, _slice$1, _index$1, r, w, n, y, _q, quo, x, rem, _q$1, quo$1, x$1, rem$1;
		delta = (_slice = leftcheats, _index = k, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")).delta;
		if (prefixIsLessThan(go$subslice(new (go$sliceType(Go$Uint8))(a.d), 0, a.nd), (_slice$1 = leftcheats, _index$1 = k, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")).cutoff)) {
			delta = delta - 1 >> 0;
		}
		r = a.nd;
		w = a.nd + delta >> 0;
		n = 0;
		r = r - 1 >> 0;
		while (r >= 0) {
			n = n + (((y = k, y < 32 ? ((((a.d[r] >> 0) - 48 >> 0)) << y) : 0) >> 0)) >> 0;
			quo = (_q = n / 10, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
			rem = n - (x = 10, (((x >>> 16 << 16) * quo >> 0) + (x << 16 >>> 16) * quo) >> 0) >> 0;
			w = w - 1 >> 0;
			if (w < 800) {
				a.d[w] = ((rem + 48 >> 0) << 24 >>> 24);
			} else if (!((rem === 0))) {
				a.trunc = true;
			}
			n = quo;
			r = r - 1 >> 0;
		}
		while (n > 0) {
			quo$1 = (_q$1 = n / 10, (_q$1 === _q$1 && _q$1 !== 1/0 && _q$1 !== -1/0) ? _q$1 >> 0 : go$throwRuntimeError("integer divide by zero"));
			rem$1 = n - (x$1 = 10, (((x$1 >>> 16 << 16) * quo$1 >> 0) + (x$1 << 16 >>> 16) * quo$1) >> 0) >> 0;
			w = w - 1 >> 0;
			if (w < 800) {
				a.d[w] = ((rem$1 + 48 >> 0) << 24 >>> 24);
			} else if (!((rem$1 === 0))) {
				a.trunc = true;
			}
			n = quo$1;
		}
		a.nd = a.nd + (delta) >> 0;
		if (a.nd >= 800) {
			a.nd = 800;
		}
		a.dp = a.dp + (delta) >> 0;
		trim(a);
	};
	decimal.Ptr.prototype.Shift = function(k) {
		var a;
		a = this;
		if (a.nd === 0) {
		} else if (k > 0) {
			while (k > 27) {
				leftShift(a, 27);
				k = k - 27 >> 0;
			}
			leftShift(a, (k >>> 0));
		} else if (k < 0) {
			while (k < -27) {
				rightShift(a, 27);
				k = k + 27 >> 0;
			}
			rightShift(a, (-k >>> 0));
		}
	};
	decimal.prototype.Shift = function(k) { return this.go$val.Shift(k); };
	var shouldRoundUp = function(a, nd) {
		var _r;
		if (nd < 0 || nd >= a.nd) {
			return false;
		}
		if ((a.d[nd] === 53) && ((nd + 1 >> 0) === a.nd)) {
			if (a.trunc) {
				return true;
			}
			return nd > 0 && !(((_r = ((a.d[(nd - 1 >> 0)] - 48 << 24 >>> 24)) % 2, _r === _r ? _r : go$throwRuntimeError("integer divide by zero")) === 0));
		}
		return a.d[nd] >= 53;
	};
	decimal.Ptr.prototype.Round = function(nd) {
		var a;
		a = this;
		if (nd < 0 || nd >= a.nd) {
			return;
		}
		if (shouldRoundUp(a, nd)) {
			a.RoundUp(nd);
		} else {
			a.RoundDown(nd);
		}
	};
	decimal.prototype.Round = function(nd) { return this.go$val.Round(nd); };
	decimal.Ptr.prototype.RoundDown = function(nd) {
		var a;
		a = this;
		if (nd < 0 || nd >= a.nd) {
			return;
		}
		a.nd = nd;
		trim(a);
	};
	decimal.prototype.RoundDown = function(nd) { return this.go$val.RoundDown(nd); };
	decimal.Ptr.prototype.RoundUp = function(nd) {
		var a, i, c, _lhs, _index;
		a = this;
		if (nd < 0 || nd >= a.nd) {
			return;
		}
		i = nd - 1 >> 0;
		while (i >= 0) {
			c = a.d[i];
			if (c < 57) {
				_lhs = a.d, _index = i, _lhs[_index] = _lhs[_index] + 1 << 24 >>> 24;
				a.nd = i + 1 >> 0;
				return;
			}
			i = i - 1 >> 0;
		}
		a.d[0] = 49;
		a.nd = 1;
		a.dp = a.dp + 1 >> 0;
	};
	decimal.prototype.RoundUp = function(nd) { return this.go$val.RoundUp(nd); };
	decimal.Ptr.prototype.RoundedInteger = function() {
		var a, i, n, x, x$1;
		a = this;
		if (a.dp > 20) {
			return new Go$Uint64(4294967295, 4294967295);
		}
		i = 0;
		n = new Go$Uint64(0, 0);
		i = 0;
		while (i < a.dp && i < a.nd) {
			n = (x = go$mul64(n, new Go$Uint64(0, 10)), x$1 = new Go$Uint64(0, (a.d[i] - 48 << 24 >>> 24)), new Go$Uint64(x.high + x$1.high, x.low + x$1.low));
			i = i + 1 >> 0;
		}
		while (i < a.dp) {
			n = go$mul64(n, new Go$Uint64(0, 10));
			i = i + 1 >> 0;
		}
		if (shouldRoundUp(a, a.dp)) {
			n = new Go$Uint64(n.high + 0, n.low + 1);
		}
		return n;
	};
	decimal.prototype.RoundedInteger = function() { return this.go$val.RoundedInteger(); };
	extFloat.Ptr.prototype.floatBits = function(flt) {
		var bits, overflow, f, exp, n, mant, x, x$1, x$2, x$3, y, x$4, x$5, y$1, x$6, x$7, x$8, y$2, x$9;
		bits = new Go$Uint64(0, 0);
		overflow = false;
		f = this;
		f.Normalize();
		exp = f.exp + 63 >> 0;
		if (exp < (flt.bias + 1 >> 0)) {
			n = (flt.bias + 1 >> 0) - exp >> 0;
			f.mant = go$shiftRightUint64(f.mant, ((n >>> 0)));
			exp = exp + (n) >> 0;
		}
		mant = go$shiftRightUint64(f.mant, ((63 - flt.mantbits >>> 0)));
		if (!((x = (x$1 = f.mant, x$2 = go$shiftLeft64(new Go$Uint64(0, 1), ((62 - flt.mantbits >>> 0))), new Go$Uint64(x$1.high & x$2.high, (x$1.low & x$2.low) >>> 0)), (x.high === 0 && x.low === 0)))) {
			mant = new Go$Uint64(mant.high + 0, mant.low + 1);
		}
		if ((x$3 = go$shiftLeft64(new Go$Uint64(0, 2), flt.mantbits), (mant.high === x$3.high && mant.low === x$3.low))) {
			mant = go$shiftRightUint64(mant, 1);
			exp = exp + 1 >> 0;
		}
		if ((exp - flt.bias >> 0) >= (((y = flt.expbits, y < 32 ? (1 << y) : 0) >> 0) - 1 >> 0)) {
			mant = new Go$Uint64(0, 0);
			exp = (((y$1 = flt.expbits, y$1 < 32 ? (1 << y$1) : 0) >> 0) - 1 >> 0) + flt.bias >> 0;
			overflow = true;
		} else if ((x$4 = (x$5 = go$shiftLeft64(new Go$Uint64(0, 1), flt.mantbits), new Go$Uint64(mant.high & x$5.high, (mant.low & x$5.low) >>> 0)), (x$4.high === 0 && x$4.low === 0))) {
			exp = flt.bias;
		}
		bits = (x$6 = (x$7 = go$shiftLeft64(new Go$Uint64(0, 1), flt.mantbits), new Go$Uint64(x$7.high - 0, x$7.low - 1)), new Go$Uint64(mant.high & x$6.high, (mant.low & x$6.low) >>> 0));
		bits = (x$8 = go$shiftLeft64(new Go$Uint64(0, (((exp - flt.bias >> 0)) & ((((y$2 = flt.expbits, y$2 < 32 ? (1 << y$2) : 0) >> 0) - 1 >> 0)))), flt.mantbits), new Go$Uint64(bits.high | x$8.high, (bits.low | x$8.low) >>> 0));
		if (f.neg) {
			bits = (x$9 = go$shiftLeft64(new Go$Uint64(0, 1), ((flt.mantbits + flt.expbits >>> 0))), new Go$Uint64(bits.high | x$9.high, (bits.low | x$9.low) >>> 0));
		}
		return [bits, overflow];
	};
	extFloat.prototype.floatBits = function(flt) { return this.go$val.floatBits(flt); };
	extFloat.Ptr.prototype.AssignComputeBounds = function(mant, exp, neg, flt) {
		var lower, upper, f, x, _struct, _struct$1, _tuple, _struct$2, _struct$3, expBiased, x$1, x$2, x$3, x$4, _struct$4, _struct$5;
		lower = new extFloat.Ptr();
		upper = new extFloat.Ptr();
		f = this;
		f.mant = mant;
		f.exp = exp - (flt.mantbits >> 0) >> 0;
		f.neg = neg;
		if (f.exp <= 0 && (x = go$shiftLeft64((go$shiftRightUint64(mant, (-f.exp >>> 0))), (-f.exp >>> 0)), (mant.high === x.high && mant.low === x.low))) {
			f.mant = go$shiftRightUint64(f.mant, ((-f.exp >>> 0)));
			f.exp = 0;
			_tuple = [(_struct = f, new extFloat.Ptr(_struct.mant, _struct.exp, _struct.neg)), (_struct$1 = f, new extFloat.Ptr(_struct$1.mant, _struct$1.exp, _struct$1.neg))], lower = _tuple[0], upper = _tuple[1];
			return [(_struct$2 = lower, new extFloat.Ptr(_struct$2.mant, _struct$2.exp, _struct$2.neg)), (_struct$3 = upper, new extFloat.Ptr(_struct$3.mant, _struct$3.exp, _struct$3.neg))];
		}
		expBiased = exp - flt.bias >> 0;
		upper = new extFloat.Ptr((x$1 = go$mul64(new Go$Uint64(0, 2), f.mant), new Go$Uint64(x$1.high + 0, x$1.low + 1)), f.exp - 1 >> 0, f.neg);
		if (!((x$2 = go$shiftLeft64(new Go$Uint64(0, 1), flt.mantbits), (mant.high === x$2.high && mant.low === x$2.low))) || (expBiased === 1)) {
			lower = new extFloat.Ptr((x$3 = go$mul64(new Go$Uint64(0, 2), f.mant), new Go$Uint64(x$3.high - 0, x$3.low - 1)), f.exp - 1 >> 0, f.neg);
		} else {
			lower = new extFloat.Ptr((x$4 = go$mul64(new Go$Uint64(0, 4), f.mant), new Go$Uint64(x$4.high - 0, x$4.low - 1)), f.exp - 2 >> 0, f.neg);
		}
		return [(_struct$4 = lower, new extFloat.Ptr(_struct$4.mant, _struct$4.exp, _struct$4.neg)), (_struct$5 = upper, new extFloat.Ptr(_struct$5.mant, _struct$5.exp, _struct$5.neg))];
	};
	extFloat.prototype.AssignComputeBounds = function(mant, exp, neg, flt) { return this.go$val.AssignComputeBounds(mant, exp, neg, flt); };
	extFloat.Ptr.prototype.Normalize = function() {
		var shift, f, _tuple, mant, exp, x, x$1, x$2, x$3, x$4, x$5, _tuple$1;
		shift = 0;
		f = this;
		_tuple = [f.mant, f.exp], mant = _tuple[0], exp = _tuple[1];
		if ((mant.high === 0 && mant.low === 0)) {
			shift = 0;
			return shift;
		}
		if ((x = go$shiftRightUint64(mant, 32), (x.high === 0 && x.low === 0))) {
			mant = go$shiftLeft64(mant, 32);
			exp = exp - 32 >> 0;
		}
		if ((x$1 = go$shiftRightUint64(mant, 48), (x$1.high === 0 && x$1.low === 0))) {
			mant = go$shiftLeft64(mant, 16);
			exp = exp - 16 >> 0;
		}
		if ((x$2 = go$shiftRightUint64(mant, 56), (x$2.high === 0 && x$2.low === 0))) {
			mant = go$shiftLeft64(mant, 8);
			exp = exp - 8 >> 0;
		}
		if ((x$3 = go$shiftRightUint64(mant, 60), (x$3.high === 0 && x$3.low === 0))) {
			mant = go$shiftLeft64(mant, 4);
			exp = exp - 4 >> 0;
		}
		if ((x$4 = go$shiftRightUint64(mant, 62), (x$4.high === 0 && x$4.low === 0))) {
			mant = go$shiftLeft64(mant, 2);
			exp = exp - 2 >> 0;
		}
		if ((x$5 = go$shiftRightUint64(mant, 63), (x$5.high === 0 && x$5.low === 0))) {
			mant = go$shiftLeft64(mant, 1);
			exp = exp - 1 >> 0;
		}
		shift = ((f.exp - exp >> 0) >>> 0);
		_tuple$1 = [mant, exp], f.mant = _tuple$1[0], f.exp = _tuple$1[1];
		return shift;
	};
	extFloat.prototype.Normalize = function() { return this.go$val.Normalize(); };
	extFloat.Ptr.prototype.Multiply = function(g) {
		var f, _tuple, fhi, flo, _tuple$1, ghi, glo, cross1, cross2, x, x$1, x$2, x$3, x$4, x$5, x$6, x$7, rem, x$8, x$9;
		f = this;
		_tuple = [go$shiftRightUint64(f.mant, 32), new Go$Uint64(0, (f.mant.low >>> 0))], fhi = _tuple[0], flo = _tuple[1];
		_tuple$1 = [go$shiftRightUint64(g.mant, 32), new Go$Uint64(0, (g.mant.low >>> 0))], ghi = _tuple$1[0], glo = _tuple$1[1];
		cross1 = go$mul64(fhi, glo);
		cross2 = go$mul64(flo, ghi);
		f.mant = (x = (x$1 = go$mul64(fhi, ghi), x$2 = go$shiftRightUint64(cross1, 32), new Go$Uint64(x$1.high + x$2.high, x$1.low + x$2.low)), x$3 = go$shiftRightUint64(cross2, 32), new Go$Uint64(x.high + x$3.high, x.low + x$3.low));
		rem = (x$4 = (x$5 = new Go$Uint64(0, (cross1.low >>> 0)), x$6 = new Go$Uint64(0, (cross2.low >>> 0)), new Go$Uint64(x$5.high + x$6.high, x$5.low + x$6.low)), x$7 = go$shiftRightUint64((go$mul64(flo, glo)), 32), new Go$Uint64(x$4.high + x$7.high, x$4.low + x$7.low));
		rem = new Go$Uint64(rem.high + 0, rem.low + 2147483648);
		f.mant = (x$8 = f.mant, x$9 = (go$shiftRightUint64(rem, 32)), new Go$Uint64(x$8.high + x$9.high, x$8.low + x$9.low));
		f.exp = (f.exp + g.exp >> 0) + 64 >> 0;
	};
	extFloat.prototype.Multiply = function(g) { return this.go$val.Multiply(g); };
	extFloat.Ptr.prototype.AssignDecimal = function(mantissa, exp10, neg, trunc, flt) {
		var ok, f, errors$1, _q, i, _r, adjExp, x, _struct, _struct$1, shift, y, denormalExp, extrabits, halfway, x$1, x$2, x$3, mant_extra, x$4, x$5, x$6, x$7, x$8, x$9, x$10, x$11;
		ok = false;
		f = this;
		errors$1 = 0;
		if (trunc) {
			errors$1 = errors$1 + 4 >> 0;
		}
		f.mant = mantissa;
		f.exp = 0;
		f.neg = neg;
		i = (_q = ((exp10 - -348 >> 0)) / 8, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
		if (exp10 < -348 || i >= 87) {
			ok = false;
			return ok;
		}
		adjExp = (_r = ((exp10 - -348 >> 0)) % 8, _r === _r ? _r : go$throwRuntimeError("integer divide by zero"));
		if (adjExp < 19 && (x = uint64pow10[(19 - adjExp >> 0)], (mantissa.high < x.high || (mantissa.high === x.high && mantissa.low < x.low)))) {
			f.mant = go$mul64(f.mant, (uint64pow10[adjExp]));
			f.Normalize();
		} else {
			f.Normalize();
			f.Multiply((_struct = smallPowersOfTen[adjExp], new extFloat.Ptr(_struct.mant, _struct.exp, _struct.neg)));
			errors$1 = errors$1 + 4 >> 0;
		}
		f.Multiply((_struct$1 = powersOfTen[i], new extFloat.Ptr(_struct$1.mant, _struct$1.exp, _struct$1.neg)));
		if (errors$1 > 0) {
			errors$1 = errors$1 + 1 >> 0;
		}
		errors$1 = errors$1 + 4 >> 0;
		shift = f.Normalize();
		errors$1 = (y = (shift), y < 32 ? (errors$1 << y) : 0) >> 0;
		denormalExp = flt.bias - 63 >> 0;
		extrabits = 0;
		if (f.exp <= denormalExp) {
			extrabits = (((63 - flt.mantbits >>> 0) + 1 >>> 0) + ((denormalExp - f.exp >> 0) >>> 0) >>> 0);
		} else {
			extrabits = (63 - flt.mantbits >>> 0);
		}
		halfway = go$shiftLeft64(new Go$Uint64(0, 1), ((extrabits - 1 >>> 0)));
		mant_extra = (x$1 = f.mant, x$2 = (x$3 = go$shiftLeft64(new Go$Uint64(0, 1), extrabits), new Go$Uint64(x$3.high - 0, x$3.low - 1)), new Go$Uint64(x$1.high & x$2.high, (x$1.low & x$2.low) >>> 0));
		if ((x$4 = (x$5 = new Go$Int64(halfway.high, halfway.low), x$6 = new Go$Int64(0, errors$1), new Go$Int64(x$5.high - x$6.high, x$5.low - x$6.low)), x$7 = new Go$Int64(mant_extra.high, mant_extra.low), (x$4.high < x$7.high || (x$4.high === x$7.high && x$4.low < x$7.low))) && (x$8 = new Go$Int64(mant_extra.high, mant_extra.low), x$9 = (x$10 = new Go$Int64(halfway.high, halfway.low), x$11 = new Go$Int64(0, errors$1), new Go$Int64(x$10.high + x$11.high, x$10.low + x$11.low)), (x$8.high < x$9.high || (x$8.high === x$9.high && x$8.low < x$9.low)))) {
			ok = false;
			return ok;
		}
		ok = true;
		return ok;
	};
	extFloat.prototype.AssignDecimal = function(mantissa, exp10, neg, trunc, flt) { return this.go$val.AssignDecimal(mantissa, exp10, neg, trunc, flt); };
	extFloat.Ptr.prototype.frexp10 = function() {
		var exp10, index, f, _q, x, x$1, approxExp10, _q$1, i, exp, _struct, _tuple;
		exp10 = 0;
		index = 0;
		f = this;
		approxExp10 = (_q = (x = (-46 - f.exp >> 0), x$1 = 28, (((x >>> 16 << 16) * x$1 >> 0) + (x << 16 >>> 16) * x$1) >> 0) / 93, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
		i = (_q$1 = ((approxExp10 - -348 >> 0)) / 8, (_q$1 === _q$1 && _q$1 !== 1/0 && _q$1 !== -1/0) ? _q$1 >> 0 : go$throwRuntimeError("integer divide by zero"));
		Loop:
		while (true) {
			exp = (f.exp + powersOfTen[i].exp >> 0) + 64 >> 0;
			if (exp < -60) {
				i = i + 1 >> 0;
			} else if (exp > -32) {
				i = i - 1 >> 0;
			} else {
				break Loop;
			}
		}
		f.Multiply((_struct = powersOfTen[i], new extFloat.Ptr(_struct.mant, _struct.exp, _struct.neg)));
		_tuple = [-((-348 + ((((i >>> 16 << 16) * 8 >> 0) + (i << 16 >>> 16) * 8) >> 0) >> 0)), i], exp10 = _tuple[0], index = _tuple[1];
		return [exp10, index];
	};
	extFloat.prototype.frexp10 = function() { return this.go$val.frexp10(); };
	var frexp10Many = function(a, b, c) {
		var exp10, _tuple, i, _struct, _struct$1;
		exp10 = 0;
		_tuple = c.frexp10(), exp10 = _tuple[0], i = _tuple[1];
		a.Multiply((_struct = powersOfTen[i], new extFloat.Ptr(_struct.mant, _struct.exp, _struct.neg)));
		b.Multiply((_struct$1 = powersOfTen[i], new extFloat.Ptr(_struct$1.mant, _struct$1.exp, _struct$1.neg)));
		return exp10;
	};
	extFloat.Ptr.prototype.FixedDecimal = function(d, n) {
		var f, x, _tuple, exp10, shift, integer, x$1, x$2, fraction, nonAsciiName, needed, integerDigits, pow10, _tuple$1, i, pow, x$3, rest, _q, x$4, buf, pos, v, _q$1, v1, x$5, i$1, _slice, _index, nd, x$6, x$7, digit, _slice$1, _index$1, x$8, x$9, ok, i$2, _slice$2, _index$2;
		f = this;
		if ((x = f.mant, (x.high === 0 && x.low === 0))) {
			d.nd = 0;
			d.dp = 0;
			d.neg = f.neg;
			return true;
		}
		if (n === 0) {
			throw go$panic(new Go$String("strconv: internal error: extFloat.FixedDecimal called with n == 0"));
		}
		f.Normalize();
		_tuple = f.frexp10(), exp10 = _tuple[0];
		shift = (-f.exp >>> 0);
		integer = (go$shiftRightUint64(f.mant, shift).low >>> 0);
		fraction = (x$1 = f.mant, x$2 = go$shiftLeft64(new Go$Uint64(0, integer), shift), new Go$Uint64(x$1.high - x$2.high, x$1.low - x$2.low));
		nonAsciiName = new Go$Uint64(0, 1);
		needed = n;
		integerDigits = 0;
		pow10 = new Go$Uint64(0, 1);
		_tuple$1 = [0, new Go$Uint64(0, 1)], i = _tuple$1[0], pow = _tuple$1[1];
		while (i < 20) {
			if ((x$3 = new Go$Uint64(0, integer), (pow.high > x$3.high || (pow.high === x$3.high && pow.low > x$3.low)))) {
				integerDigits = i;
				break;
			}
			pow = go$mul64(pow, new Go$Uint64(0, 10));
			i = i + 1 >> 0;
		}
		rest = integer;
		if (integerDigits > needed) {
			pow10 = uint64pow10[(integerDigits - needed >> 0)];
			integer = (_q = integer / ((pow10.low >>> 0)), (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >>> 0 : go$throwRuntimeError("integer divide by zero"));
			rest = rest - ((x$4 = (pow10.low >>> 0), (((integer >>> 16 << 16) * x$4 >>> 0) + (integer << 16 >>> 16) * x$4) >>> 0)) >>> 0;
		} else {
			rest = 0;
		}
		buf = go$makeNativeArray("Uint8", 32, function() { return 0; });
		pos = 32;
		v = integer;
		while (v > 0) {
			v1 = (_q$1 = v / 10, (_q$1 === _q$1 && _q$1 !== 1/0 && _q$1 !== -1/0) ? _q$1 >>> 0 : go$throwRuntimeError("integer divide by zero"));
			v = v - ((x$5 = 10, (((x$5 >>> 16 << 16) * v1 >>> 0) + (x$5 << 16 >>> 16) * v1) >>> 0)) >>> 0;
			pos = pos - 1 >> 0;
			buf[pos] = ((v + 48 >>> 0) << 24 >>> 24);
			v = v1;
		}
		i$1 = pos;
		while (i$1 < 32) {
			_slice = d.d, _index = i$1 - pos >> 0, (_index >= 0 && _index < _slice.length) ? (_slice.array[_slice.offset + _index] = buf[i$1]) : go$throwRuntimeError("index out of range");
			i$1 = i$1 + 1 >> 0;
		}
		nd = 32 - pos >> 0;
		d.nd = nd;
		d.dp = integerDigits + exp10 >> 0;
		needed = needed - (nd) >> 0;
		if (needed > 0) {
			if (!((rest === 0)) || !((pow10.high === 0 && pow10.low === 1))) {
				throw go$panic(new Go$String("strconv: internal error, rest != 0 but needed > 0"));
			}
			while (needed > 0) {
				fraction = go$mul64(fraction, new Go$Uint64(0, 10));
				nonAsciiName = go$mul64(nonAsciiName, new Go$Uint64(0, 10));
				if ((x$6 = go$mul64(new Go$Uint64(0, 2), nonAsciiName), x$7 = go$shiftLeft64(new Go$Uint64(0, 1), shift), (x$6.high > x$7.high || (x$6.high === x$7.high && x$6.low > x$7.low)))) {
					return false;
				}
				digit = go$shiftRightUint64(fraction, shift);
				_slice$1 = d.d, _index$1 = nd, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = (new Go$Uint64(digit.high + 0, digit.low + 48).low << 24 >>> 24)) : go$throwRuntimeError("index out of range");
				fraction = (x$8 = go$shiftLeft64(digit, shift), new Go$Uint64(fraction.high - x$8.high, fraction.low - x$8.low));
				nd = nd + 1 >> 0;
				needed = needed - 1 >> 0;
			}
			d.nd = nd;
		}
		ok = adjustLastDigitFixed(d, (x$9 = go$shiftLeft64(new Go$Uint64(0, rest), shift), new Go$Uint64(x$9.high | fraction.high, (x$9.low | fraction.low) >>> 0)), pow10, shift, nonAsciiName);
		if (!ok) {
			return false;
		}
		i$2 = d.nd - 1 >> 0;
		while (i$2 >= 0) {
			if (!(((_slice$2 = d.d, _index$2 = i$2, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")) === 48))) {
				d.nd = i$2 + 1 >> 0;
				break;
			}
			i$2 = i$2 - 1 >> 0;
		}
		return true;
	};
	extFloat.prototype.FixedDecimal = function(d, n) { return this.go$val.FixedDecimal(d, n); };
	var adjustLastDigitFixed = function(d, num, den, shift, nonAsciiName) {
		var x, x$1, x$2, x$3, x$4, x$5, x$6, i, _slice, _index, _slice$1, _index$1, _lhs, _index$2, _slice$2, _index$3, _slice$3, _index$4;
		if ((x = go$shiftLeft64(den, shift), (num.high > x.high || (num.high === x.high && num.low > x.low)))) {
			throw go$panic(new Go$String("strconv: num > den<<shift in adjustLastDigitFixed"));
		}
		if ((x$1 = go$mul64(new Go$Uint64(0, 2), nonAsciiName), x$2 = go$shiftLeft64(den, shift), (x$1.high > x$2.high || (x$1.high === x$2.high && x$1.low > x$2.low)))) {
			throw go$panic(new Go$String("strconv: \xCE\xB5 > (den<<shift)/2"));
		}
		if ((x$3 = go$mul64(new Go$Uint64(0, 2), (new Go$Uint64(num.high + nonAsciiName.high, num.low + nonAsciiName.low))), x$4 = go$shiftLeft64(den, shift), (x$3.high < x$4.high || (x$3.high === x$4.high && x$3.low < x$4.low)))) {
			return true;
		}
		if ((x$5 = go$mul64(new Go$Uint64(0, 2), (new Go$Uint64(num.high - nonAsciiName.high, num.low - nonAsciiName.low))), x$6 = go$shiftLeft64(den, shift), (x$5.high > x$6.high || (x$5.high === x$6.high && x$5.low > x$6.low)))) {
			i = d.nd - 1 >> 0;
			while (i >= 0) {
				if ((_slice = d.d, _index = i, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) === 57) {
					d.nd = d.nd - 1 >> 0;
				} else {
					break;
				}
				i = i - 1 >> 0;
			}
			if (i < 0) {
				_slice$1 = d.d, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = 49) : go$throwRuntimeError("index out of range");
				d.nd = 1;
				d.dp = d.dp + 1 >> 0;
			} else {
				_lhs = d.d, _index$2 = i, _slice$3 = _lhs, _index$4 = _index$2, (_index$4 >= 0 && _index$4 < _slice$3.length) ? (_slice$3.array[_slice$3.offset + _index$4] = (_slice$2 = _lhs, _index$3 = _index$2, (_index$3 >= 0 && _index$3 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$3] : go$throwRuntimeError("index out of range")) + 1 << 24 >>> 24) : go$throwRuntimeError("index out of range");
			}
			return true;
		}
		return false;
	};
	extFloat.Ptr.prototype.ShortestDecimal = function(d, lower, upper) {
		var f, x, x$1, y, x$2, y$1, buf, n, v, v1, x$3, nd, i, _slice, _index, _tuple, _slice$1, _index$1, exp10, x$4, x$5, shift, integer, x$6, x$7, fraction, x$8, x$9, allowance, x$10, x$11, targetDiff, integerDigits, _tuple$1, i$1, pow, x$12, i$2, pow$1, _q, digit, _slice$2, _index$2, x$13, currentDiff, x$14, digit$1, multiplier, _slice$3, _index$3, x$15, x$16;
		f = this;
		if ((x = f.mant, (x.high === 0 && x.low === 0))) {
			d.nd = 0;
			d.dp = 0;
			d.neg = f.neg;
			return true;
		}
		if ((f.exp === 0) && (x$1 = lower, y = f, (x$1.mant.high === y.mant.high && x$1.mant.low === y.mant.low) && x$1.exp === y.exp && x$1.neg === y.neg) && (x$2 = lower, y$1 = upper, (x$2.mant.high === y$1.mant.high && x$2.mant.low === y$1.mant.low) && x$2.exp === y$1.exp && x$2.neg === y$1.neg)) {
			buf = go$makeNativeArray("Uint8", 24, function() { return 0; });
			n = 23;
			v = f.mant;
			while ((v.high > 0 || (v.high === 0 && v.low > 0))) {
				v1 = go$div64(v, new Go$Uint64(0, 10), false);
				v = (x$3 = go$mul64(new Go$Uint64(0, 10), v1), new Go$Uint64(v.high - x$3.high, v.low - x$3.low));
				buf[n] = (new Go$Uint64(v.high + 0, v.low + 48).low << 24 >>> 24);
				n = n - 1 >> 0;
				v = v1;
			}
			nd = (24 - n >> 0) - 1 >> 0;
			i = 0;
			while (i < nd) {
				_slice = d.d, _index = i, (_index >= 0 && _index < _slice.length) ? (_slice.array[_slice.offset + _index] = buf[((n + 1 >> 0) + i >> 0)]) : go$throwRuntimeError("index out of range");
				i = i + 1 >> 0;
			}
			_tuple = [nd, nd], d.nd = _tuple[0], d.dp = _tuple[1];
			while (d.nd > 0 && ((_slice$1 = d.d, _index$1 = (d.nd - 1 >> 0), (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")) === 48)) {
				d.nd = d.nd - 1 >> 0;
			}
			if (d.nd === 0) {
				d.dp = 0;
			}
			d.neg = f.neg;
			return true;
		}
		upper.Normalize();
		if (f.exp > upper.exp) {
			f.mant = go$shiftLeft64(f.mant, (((f.exp - upper.exp >> 0) >>> 0)));
			f.exp = upper.exp;
		}
		if (lower.exp > upper.exp) {
			lower.mant = go$shiftLeft64(lower.mant, (((lower.exp - upper.exp >> 0) >>> 0)));
			lower.exp = upper.exp;
		}
		exp10 = frexp10Many(lower, f, upper);
		upper.mant = (x$4 = upper.mant, new Go$Uint64(x$4.high + 0, x$4.low + 1));
		lower.mant = (x$5 = lower.mant, new Go$Uint64(x$5.high - 0, x$5.low - 1));
		shift = (-upper.exp >>> 0);
		integer = (go$shiftRightUint64(upper.mant, shift).low >>> 0);
		fraction = (x$6 = upper.mant, x$7 = go$shiftLeft64(new Go$Uint64(0, integer), shift), new Go$Uint64(x$6.high - x$7.high, x$6.low - x$7.low));
		allowance = (x$8 = upper.mant, x$9 = lower.mant, new Go$Uint64(x$8.high - x$9.high, x$8.low - x$9.low));
		targetDiff = (x$10 = upper.mant, x$11 = f.mant, new Go$Uint64(x$10.high - x$11.high, x$10.low - x$11.low));
		integerDigits = 0;
		_tuple$1 = [0, new Go$Uint64(0, 1)], i$1 = _tuple$1[0], pow = _tuple$1[1];
		while (i$1 < 20) {
			if ((x$12 = new Go$Uint64(0, integer), (pow.high > x$12.high || (pow.high === x$12.high && pow.low > x$12.low)))) {
				integerDigits = i$1;
				break;
			}
			pow = go$mul64(pow, new Go$Uint64(0, 10));
			i$1 = i$1 + 1 >> 0;
		}
		i$2 = 0;
		while (i$2 < integerDigits) {
			pow$1 = uint64pow10[((integerDigits - i$2 >> 0) - 1 >> 0)];
			digit = (_q = integer / (pow$1.low >>> 0), (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >>> 0 : go$throwRuntimeError("integer divide by zero"));
			_slice$2 = d.d, _index$2 = i$2, (_index$2 >= 0 && _index$2 < _slice$2.length) ? (_slice$2.array[_slice$2.offset + _index$2] = ((digit + 48 >>> 0) << 24 >>> 24)) : go$throwRuntimeError("index out of range");
			integer = integer - ((x$13 = (pow$1.low >>> 0), (((digit >>> 16 << 16) * x$13 >>> 0) + (digit << 16 >>> 16) * x$13) >>> 0)) >>> 0;
			if (currentDiff = (x$14 = go$shiftLeft64(new Go$Uint64(0, integer), shift), new Go$Uint64(x$14.high + fraction.high, x$14.low + fraction.low)), (currentDiff.high < allowance.high || (currentDiff.high === allowance.high && currentDiff.low < allowance.low))) {
				d.nd = i$2 + 1 >> 0;
				d.dp = integerDigits + exp10 >> 0;
				d.neg = f.neg;
				return adjustLastDigit(d, currentDiff, targetDiff, allowance, go$shiftLeft64(pow$1, shift), new Go$Uint64(0, 2));
			}
			i$2 = i$2 + 1 >> 0;
		}
		d.nd = integerDigits;
		d.dp = d.nd + exp10 >> 0;
		d.neg = f.neg;
		digit$1 = 0;
		multiplier = new Go$Uint64(0, 1);
		while (true) {
			fraction = go$mul64(fraction, new Go$Uint64(0, 10));
			multiplier = go$mul64(multiplier, new Go$Uint64(0, 10));
			digit$1 = (go$shiftRightUint64(fraction, shift).low >> 0);
			_slice$3 = d.d, _index$3 = d.nd, (_index$3 >= 0 && _index$3 < _slice$3.length) ? (_slice$3.array[_slice$3.offset + _index$3] = ((digit$1 + 48 >> 0) << 24 >>> 24)) : go$throwRuntimeError("index out of range");
			d.nd = d.nd + 1 >> 0;
			fraction = (x$15 = go$shiftLeft64(new Go$Uint64(0, digit$1), shift), new Go$Uint64(fraction.high - x$15.high, fraction.low - x$15.low));
			if ((x$16 = go$mul64(allowance, multiplier), (fraction.high < x$16.high || (fraction.high === x$16.high && fraction.low < x$16.low)))) {
				return adjustLastDigit(d, fraction, go$mul64(targetDiff, multiplier), go$mul64(allowance, multiplier), go$shiftLeft64(new Go$Uint64(0, 1), shift), go$mul64(multiplier, new Go$Uint64(0, 2)));
			}
		}
	};
	extFloat.prototype.ShortestDecimal = function(d, lower, upper) { return this.go$val.ShortestDecimal(d, lower, upper); };
	var adjustLastDigit = function(d, currentDiff, targetDiff, maxDiff, ulpDecimal, ulpBinary) {
		var x, x$1, x$2, x$3, _lhs, _index, _slice, _index$1, _slice$1, _index$2, x$4, x$5, x$6, x$7, x$8, x$9, _slice$2, _index$3;
		if ((x = go$mul64(new Go$Uint64(0, 2), ulpBinary), (ulpDecimal.high < x.high || (ulpDecimal.high === x.high && ulpDecimal.low < x.low)))) {
			return false;
		}
		while ((x$1 = (x$2 = (x$3 = go$div64(ulpDecimal, new Go$Uint64(0, 2), false), new Go$Uint64(currentDiff.high + x$3.high, currentDiff.low + x$3.low)), new Go$Uint64(x$2.high + ulpBinary.high, x$2.low + ulpBinary.low)), (x$1.high < targetDiff.high || (x$1.high === targetDiff.high && x$1.low < targetDiff.low)))) {
			_lhs = d.d, _index = d.nd - 1 >> 0, _slice$1 = _lhs, _index$2 = _index, (_index$2 >= 0 && _index$2 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$2] = (_slice = _lhs, _index$1 = _index, (_index$1 >= 0 && _index$1 < _slice.length) ? _slice.array[_slice.offset + _index$1] : go$throwRuntimeError("index out of range")) - 1 << 24 >>> 24) : go$throwRuntimeError("index out of range");
			currentDiff = (x$4 = ulpDecimal, new Go$Uint64(currentDiff.high + x$4.high, currentDiff.low + x$4.low));
		}
		if ((x$5 = new Go$Uint64(currentDiff.high + ulpDecimal.high, currentDiff.low + ulpDecimal.low), x$6 = (x$7 = (x$8 = go$div64(ulpDecimal, new Go$Uint64(0, 2), false), new Go$Uint64(targetDiff.high + x$8.high, targetDiff.low + x$8.low)), new Go$Uint64(x$7.high + ulpBinary.high, x$7.low + ulpBinary.low)), (x$5.high < x$6.high || (x$5.high === x$6.high && x$5.low <= x$6.low)))) {
			return false;
		}
		if ((currentDiff.high < ulpBinary.high || (currentDiff.high === ulpBinary.high && currentDiff.low < ulpBinary.low)) || (x$9 = new Go$Uint64(maxDiff.high - ulpBinary.high, maxDiff.low - ulpBinary.low), (currentDiff.high > x$9.high || (currentDiff.high === x$9.high && currentDiff.low > x$9.low)))) {
			return false;
		}
		if ((d.nd === 1) && ((_slice$2 = d.d, _index$3 = 0, (_index$3 >= 0 && _index$3 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$3] : go$throwRuntimeError("index out of range")) === 48)) {
			d.nd = 0;
			d.dp = 0;
		}
		return true;
	};
	var FormatFloat = go$pkg.FormatFloat = function(f, fmt, prec, bitSize) {
		return go$bytesToString(genericFtoa((go$sliceType(Go$Uint8)).make(0, max(prec + 4 >> 0, 24), function() { return 0; }), f, fmt, prec, bitSize));
	};
	var AppendFloat = go$pkg.AppendFloat = function(dst, f, fmt, prec, bitSize) {
		return genericFtoa(dst, f, fmt, prec, bitSize);
	};
	var genericFtoa = function(dst, val, fmt, prec, bitSize) {
		var bits, flt, _ref, x, neg, y, exp, x$1, x$2, mant, _ref$1, y$1, s, x$3, digs, ok, shortest, f, _tuple, _struct, lower, _struct$1, upper, buf, _ref$2, digits, _ref$3, buf$1, f$1, _struct$2;
		bits = new Go$Uint64(0, 0);
		flt = (go$ptrType(floatInfo)).nil;
		_ref = bitSize;
		if (_ref === 32) {
			bits = new Go$Uint64(0, math.Float32bits(val));
			flt = float32info;
		} else if (_ref === 64) {
			bits = math.Float64bits(val);
			flt = float64info;
		} else {
			throw go$panic(new Go$String("strconv: illegal AppendFloat/FormatFloat bitSize"));
		}
		neg = !((x = go$shiftRightUint64(bits, ((flt.expbits + flt.mantbits >>> 0))), (x.high === 0 && x.low === 0)));
		exp = (go$shiftRightUint64(bits, flt.mantbits).low >> 0) & ((((y = flt.expbits, y < 32 ? (1 << y) : 0) >> 0) - 1 >> 0));
		mant = (x$1 = (x$2 = go$shiftLeft64(new Go$Uint64(0, 1), flt.mantbits), new Go$Uint64(x$2.high - 0, x$2.low - 1)), new Go$Uint64(bits.high & x$1.high, (bits.low & x$1.low) >>> 0));
		_ref$1 = exp;
		if (_ref$1 === (((y$1 = flt.expbits, y$1 < 32 ? (1 << y$1) : 0) >> 0) - 1 >> 0)) {
			s = "";
			if (!((mant.high === 0 && mant.low === 0))) {
				s = "NaN";
			} else if (neg) {
				s = "-Inf";
			} else {
				s = "+Inf";
			}
			return go$appendSlice(dst, new (go$sliceType(Go$Uint8))(go$stringToBytes(s)));
		} else if (_ref$1 === 0) {
			exp = exp + 1 >> 0;
		} else {
			mant = (x$3 = go$shiftLeft64(new Go$Uint64(0, 1), flt.mantbits), new Go$Uint64(mant.high | x$3.high, (mant.low | x$3.low) >>> 0));
		}
		exp = exp + (flt.bias) >> 0;
		if (fmt === 98) {
			return fmtB(dst, neg, mant, exp, flt);
		}
		if (!optimize) {
			return bigFtoa(dst, prec, fmt, neg, mant, exp, flt);
		}
		digs = new decimalSlice.Ptr();
		ok = false;
		shortest = prec < 0;
		if (shortest) {
			f = new extFloat.Ptr();
			_tuple = f.AssignComputeBounds(mant, exp, neg, flt), lower = (_struct = _tuple[0], new extFloat.Ptr(_struct.mant, _struct.exp, _struct.neg)), upper = (_struct$1 = _tuple[1], new extFloat.Ptr(_struct$1.mant, _struct$1.exp, _struct$1.neg));
			buf = go$makeNativeArray("Uint8", 32, function() { return 0; });
			digs.d = new (go$sliceType(Go$Uint8))(buf);
			ok = f.ShortestDecimal(digs, lower, upper);
			if (!ok) {
				return bigFtoa(dst, prec, fmt, neg, mant, exp, flt);
			}
			_ref$2 = fmt;
			if (_ref$2 === 101 || _ref$2 === 69) {
				prec = digs.nd - 1 >> 0;
			} else if (_ref$2 === 102) {
				prec = max(digs.nd - digs.dp >> 0, 0);
			} else if (_ref$2 === 103 || _ref$2 === 71) {
				prec = digs.nd;
			}
		} else if (!((fmt === 102))) {
			digits = prec;
			_ref$3 = fmt;
			if (_ref$3 === 101 || _ref$3 === 69) {
				digits = digits + 1 >> 0;
			} else if (_ref$3 === 103 || _ref$3 === 71) {
				if (prec === 0) {
					prec = 1;
				}
				digits = prec;
			}
			if (digits <= 15) {
				buf$1 = go$makeNativeArray("Uint8", 24, function() { return 0; });
				digs.d = new (go$sliceType(Go$Uint8))(buf$1);
				f$1 = new extFloat.Ptr(mant, exp - (flt.mantbits >> 0) >> 0, neg);
				ok = f$1.FixedDecimal(digs, digits);
			}
		}
		if (!ok) {
			return bigFtoa(dst, prec, fmt, neg, mant, exp, flt);
		}
		return formatDigits(dst, shortest, neg, (_struct$2 = digs, new decimalSlice.Ptr(_struct$2.d, _struct$2.nd, _struct$2.dp, _struct$2.neg)), prec, fmt);
	};
	var bigFtoa = function(dst, prec, fmt, neg, mant, exp, flt) {
		var d, digs, shortest, _ref, _ref$1, _struct;
		d = new decimal.Ptr();
		d.Assign(mant);
		d.Shift(exp - (flt.mantbits >> 0) >> 0);
		digs = new decimalSlice.Ptr();
		shortest = prec < 0;
		if (shortest) {
			roundShortest(d, mant, exp, flt);
			digs = new decimalSlice.Ptr(new (go$sliceType(Go$Uint8))(d.d), d.nd, d.dp, false);
			_ref = fmt;
			if (_ref === 101 || _ref === 69) {
				prec = digs.nd - 1 >> 0;
			} else if (_ref === 102) {
				prec = max(digs.nd - digs.dp >> 0, 0);
			} else if (_ref === 103 || _ref === 71) {
				prec = digs.nd;
			}
		} else {
			_ref$1 = fmt;
			if (_ref$1 === 101 || _ref$1 === 69) {
				d.Round(prec + 1 >> 0);
			} else if (_ref$1 === 102) {
				d.Round(d.dp + prec >> 0);
			} else if (_ref$1 === 103 || _ref$1 === 71) {
				if (prec === 0) {
					prec = 1;
				}
				d.Round(prec);
			}
			digs = new decimalSlice.Ptr(new (go$sliceType(Go$Uint8))(d.d), d.nd, d.dp, false);
		}
		return formatDigits(dst, shortest, neg, (_struct = digs, new decimalSlice.Ptr(_struct.d, _struct.nd, _struct.dp, _struct.neg)), prec, fmt);
	};
	var formatDigits = function(dst, shortest, neg, digs, prec, fmt) {
		var _ref, _struct, _struct$1, eprec, exp, _struct$2, _struct$3;
		_ref = fmt;
		if (_ref === 101 || _ref === 69) {
			return fmtE(dst, neg, (_struct = digs, new decimalSlice.Ptr(_struct.d, _struct.nd, _struct.dp, _struct.neg)), prec, fmt);
		} else if (_ref === 102) {
			return fmtF(dst, neg, (_struct$1 = digs, new decimalSlice.Ptr(_struct$1.d, _struct$1.nd, _struct$1.dp, _struct$1.neg)), prec);
		} else if (_ref === 103 || _ref === 71) {
			eprec = prec;
			if (eprec > digs.nd && digs.nd >= digs.dp) {
				eprec = digs.nd;
			}
			if (shortest) {
				eprec = 6;
			}
			exp = digs.dp - 1 >> 0;
			if (exp < -4 || exp >= eprec) {
				if (prec > digs.nd) {
					prec = digs.nd;
				}
				return fmtE(dst, neg, (_struct$2 = digs, new decimalSlice.Ptr(_struct$2.d, _struct$2.nd, _struct$2.dp, _struct$2.neg)), prec - 1 >> 0, (fmt + 101 << 24 >>> 24) - 103 << 24 >>> 24);
			}
			if (prec > digs.dp) {
				prec = digs.nd;
			}
			return fmtF(dst, neg, (_struct$3 = digs, new decimalSlice.Ptr(_struct$3.d, _struct$3.nd, _struct$3.dp, _struct$3.neg)), max(prec - digs.dp >> 0, 0));
		}
		return go$append(dst, 37, fmt);
	};
	var roundShortest = function(d, mant, exp, flt) {
		var minexp, x, x$1, x$2, x$3, upper, x$4, mantlo, explo, x$5, x$6, lower, x$7, x$8, inclusive, i, _tuple, l, m, u, okdown, okup;
		if ((mant.high === 0 && mant.low === 0)) {
			d.nd = 0;
			return;
		}
		minexp = flt.bias + 1 >> 0;
		if (exp > minexp && (x = 332, x$1 = (d.dp - d.nd >> 0), (((x >>> 16 << 16) * x$1 >> 0) + (x << 16 >>> 16) * x$1) >> 0) >= (x$2 = 100, x$3 = (exp - (flt.mantbits >> 0) >> 0), (((x$2 >>> 16 << 16) * x$3 >> 0) + (x$2 << 16 >>> 16) * x$3) >> 0)) {
			return;
		}
		upper = new decimal.Ptr();
		upper.Assign((x$4 = go$mul64(mant, new Go$Uint64(0, 2)), new Go$Uint64(x$4.high + 0, x$4.low + 1)));
		upper.Shift((exp - (flt.mantbits >> 0) >> 0) - 1 >> 0);
		mantlo = new Go$Uint64(0, 0);
		explo = 0;
		if ((x$5 = go$shiftLeft64(new Go$Uint64(0, 1), flt.mantbits), (mant.high > x$5.high || (mant.high === x$5.high && mant.low > x$5.low))) || (exp === minexp)) {
			mantlo = new Go$Uint64(mant.high - 0, mant.low - 1);
			explo = exp;
		} else {
			mantlo = (x$6 = go$mul64(mant, new Go$Uint64(0, 2)), new Go$Uint64(x$6.high - 0, x$6.low - 1));
			explo = exp - 1 >> 0;
		}
		lower = new decimal.Ptr();
		lower.Assign((x$7 = go$mul64(mantlo, new Go$Uint64(0, 2)), new Go$Uint64(x$7.high + 0, x$7.low + 1)));
		lower.Shift((explo - (flt.mantbits >> 0) >> 0) - 1 >> 0);
		inclusive = (x$8 = go$div64(mant, new Go$Uint64(0, 2), true), (x$8.high === 0 && x$8.low === 0));
		i = 0;
		while (i < d.nd) {
			_tuple = [0, 0, 0], l = _tuple[0], m = _tuple[1], u = _tuple[2];
			if (i < lower.nd) {
				l = lower.d[i];
			} else {
				l = 48;
			}
			m = d.d[i];
			if (i < upper.nd) {
				u = upper.d[i];
			} else {
				u = 48;
			}
			okdown = !((l === m)) || (inclusive && (l === m) && ((i + 1 >> 0) === lower.nd));
			okup = !((m === u)) && (inclusive || (m + 1 << 24 >>> 24) < u || (i + 1 >> 0) < upper.nd);
			if (okdown && okup) {
				d.Round(i + 1 >> 0);
				return;
			} else if (okdown) {
				d.RoundDown(i + 1 >> 0);
				return;
			} else if (okup) {
				d.RoundUp(i + 1 >> 0);
				return;
			}
			i = i + 1 >> 0;
		}
	};
	var fmtE = function(dst, neg, d, prec, fmt) {
		var ch, _slice, _index, i, m, _slice$1, _index$1, exp, buf, i$1, _r, _q, _ref;
		if (neg) {
			dst = go$append(dst, 45);
		}
		ch = 48;
		if (!((d.nd === 0))) {
			ch = (_slice = d.d, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range"));
		}
		dst = go$append(dst, ch);
		if (prec > 0) {
			dst = go$append(dst, 46);
			i = 1;
			m = ((d.nd + prec >> 0) + 1 >> 0) - max(d.nd, prec + 1 >> 0) >> 0;
			while (i < m) {
				dst = go$append(dst, (_slice$1 = d.d, _index$1 = i, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")));
				i = i + 1 >> 0;
			}
			while (i <= prec) {
				dst = go$append(dst, 48);
				i = i + 1 >> 0;
			}
		}
		dst = go$append(dst, fmt);
		exp = d.dp - 1 >> 0;
		if (d.nd === 0) {
			exp = 0;
		}
		if (exp < 0) {
			ch = 45;
			exp = -exp;
		} else {
			ch = 43;
		}
		dst = go$append(dst, ch);
		buf = go$makeNativeArray("Uint8", 3, function() { return 0; });
		i$1 = 3;
		while (exp >= 10) {
			i$1 = i$1 - 1 >> 0;
			buf[i$1] = (((_r = exp % 10, _r === _r ? _r : go$throwRuntimeError("integer divide by zero")) + 48 >> 0) << 24 >>> 24);
			exp = (_q = exp / 10, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
		}
		i$1 = i$1 - 1 >> 0;
		buf[i$1] = ((exp + 48 >> 0) << 24 >>> 24);
		_ref = i$1;
		if (_ref === 0) {
			dst = go$append(dst, buf[0], buf[1], buf[2]);
		} else if (_ref === 1) {
			dst = go$append(dst, buf[1], buf[2]);
		} else if (_ref === 2) {
			dst = go$append(dst, 48, buf[2]);
		}
		return dst;
	};
	var fmtF = function(dst, neg, d, prec) {
		var i, _slice, _index, i$1, ch, j, _slice$1, _index$1;
		if (neg) {
			dst = go$append(dst, 45);
		}
		if (d.dp > 0) {
			i = 0;
			i = 0;
			while (i < d.dp && i < d.nd) {
				dst = go$append(dst, (_slice = d.d, _index = i, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")));
				i = i + 1 >> 0;
			}
			while (i < d.dp) {
				dst = go$append(dst, 48);
				i = i + 1 >> 0;
			}
		} else {
			dst = go$append(dst, 48);
		}
		if (prec > 0) {
			dst = go$append(dst, 46);
			i$1 = 0;
			while (i$1 < prec) {
				ch = 48;
				if (j = d.dp + i$1 >> 0, 0 <= j && j < d.nd) {
					ch = (_slice$1 = d.d, _index$1 = j, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range"));
				}
				dst = go$append(dst, ch);
				i$1 = i$1 + 1 >> 0;
			}
		}
		return dst;
	};
	var fmtB = function(dst, neg, mant, exp, flt) {
		var buf, w, esign, n, _r, _q, x;
		buf = go$makeNativeArray("Uint8", 50, function() { return 0; });
		w = 50;
		exp = exp - ((flt.mantbits >> 0)) >> 0;
		esign = 43;
		if (exp < 0) {
			esign = 45;
			exp = -exp;
		}
		n = 0;
		while (exp > 0 || n < 1) {
			n = n + 1 >> 0;
			w = w - 1 >> 0;
			buf[w] = (((_r = exp % 10, _r === _r ? _r : go$throwRuntimeError("integer divide by zero")) + 48 >> 0) << 24 >>> 24);
			exp = (_q = exp / 10, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
		}
		w = w - 1 >> 0;
		buf[w] = esign;
		w = w - 1 >> 0;
		buf[w] = 112;
		n = 0;
		while ((mant.high > 0 || (mant.high === 0 && mant.low > 0)) || n < 1) {
			n = n + 1 >> 0;
			w = w - 1 >> 0;
			buf[w] = ((x = go$div64(mant, new Go$Uint64(0, 10), true), new Go$Uint64(x.high + 0, x.low + 48)).low << 24 >>> 24);
			mant = go$div64(mant, new Go$Uint64(0, 10), false);
		}
		if (neg) {
			w = w - 1 >> 0;
			buf[w] = 45;
		}
		return go$appendSlice(dst, go$subslice(new (go$sliceType(Go$Uint8))(buf), w));
	};
	var max = function(a, b) {
		if (a > b) {
			return a;
		}
		return b;
	};
	var FormatUint = go$pkg.FormatUint = function(i, base) {
		var _tuple, s;
		_tuple = formatBits((go$sliceType(Go$Uint8)).nil, i, base, false, false), s = _tuple[1];
		return s;
	};
	var FormatInt = go$pkg.FormatInt = function(i, base) {
		var _tuple, s;
		_tuple = formatBits((go$sliceType(Go$Uint8)).nil, new Go$Uint64(i.high, i.low), base, (i.high < 0 || (i.high === 0 && i.low < 0)), false), s = _tuple[1];
		return s;
	};
	var Itoa = go$pkg.Itoa = function(i) {
		return FormatInt(new Go$Int64(0, i), 10);
	};
	var AppendInt = go$pkg.AppendInt = function(dst, i, base) {
		var _tuple;
		_tuple = formatBits(dst, new Go$Uint64(i.high, i.low), base, (i.high < 0 || (i.high === 0 && i.low < 0)), true), dst = _tuple[0];
		return dst;
	};
	var AppendUint = go$pkg.AppendUint = function(dst, i, base) {
		var _tuple;
		_tuple = formatBits(dst, i, base, false, true), dst = _tuple[0];
		return dst;
	};
	var formatBits = function(dst, u, base, neg, append_) {
		var d, s, a, i, s$1, q, x, j, q$1, x$1, b, m, b$1;
		d = (go$sliceType(Go$Uint8)).nil;
		s = "";
		if (base < 2 || base > 36) {
			throw go$panic(new Go$String("strconv: illegal AppendInt/FormatInt base"));
		}
		a = go$makeNativeArray("Uint8", 65, function() { return 0; });
		i = 65;
		if (neg) {
			u = new Go$Uint64(-u.high, -u.low);
		}
		if (base === 10) {
			while ((u.high > 0 || (u.high === 0 && u.low >= 100))) {
				i = i - 2 >> 0;
				q = go$div64(u, new Go$Uint64(0, 100), false);
				j = ((x = go$mul64(q, new Go$Uint64(0, 100)), new Go$Uint64(u.high - x.high, u.low - x.low)).low >>> 0);
				a[i + 1 >> 0] = "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789".charCodeAt(j);
				a[i + 0 >> 0] = "0000000000111111111122222222223333333333444444444455555555556666666666777777777788888888889999999999".charCodeAt(j);
				u = q;
			}
			if ((u.high > 0 || (u.high === 0 && u.low >= 10))) {
				i = i - 1 >> 0;
				q$1 = go$div64(u, new Go$Uint64(0, 10), false);
				a[i] = "0123456789abcdefghijklmnopqrstuvwxyz".charCodeAt(((x$1 = go$mul64(q$1, new Go$Uint64(0, 10)), new Go$Uint64(u.high - x$1.high, u.low - x$1.low)).low >>> 0));
				u = q$1;
			}
		} else if (s$1 = shifts[base], s$1 > 0) {
			b = new Go$Uint64(0, base);
			m = (b.low >>> 0) - 1 >>> 0;
			while ((u.high > b.high || (u.high === b.high && u.low >= b.low))) {
				i = i - 1 >> 0;
				a[i] = "0123456789abcdefghijklmnopqrstuvwxyz".charCodeAt((((u.low >>> 0) & m) >>> 0));
				u = go$shiftRightUint64(u, (s$1));
			}
		} else {
			b$1 = new Go$Uint64(0, base);
			while ((u.high > b$1.high || (u.high === b$1.high && u.low >= b$1.low))) {
				i = i - 1 >> 0;
				a[i] = "0123456789abcdefghijklmnopqrstuvwxyz".charCodeAt((go$div64(u, b$1, true).low >>> 0));
				u = go$div64(u, (b$1), false);
			}
		}
		i = i - 1 >> 0;
		a[i] = "0123456789abcdefghijklmnopqrstuvwxyz".charCodeAt((u.low >>> 0));
		if (neg) {
			i = i - 1 >> 0;
			a[i] = 45;
		}
		if (append_) {
			d = go$appendSlice(dst, go$subslice(new (go$sliceType(Go$Uint8))(a), i));
			return [d, s];
		}
		s = go$bytesToString(go$subslice(new (go$sliceType(Go$Uint8))(a), i));
		return [d, s];
	};
	var quoteWith = function(s, quote, ASCIIonly) {
		var runeTmp, _q, x, x$1, buf, width, r, _tuple, n, _ref, s$1, s$2;
		runeTmp = go$makeNativeArray("Uint8", 4, function() { return 0; });
		buf = (go$sliceType(Go$Uint8)).make(0, (_q = (x = 3, x$1 = s.length, (((x >>> 16 << 16) * x$1 >> 0) + (x << 16 >>> 16) * x$1) >> 0) / 2, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero")), function() { return 0; });
		buf = go$append(buf, quote);
		width = 0;
		while (s.length > 0) {
			r = (s.charCodeAt(0) >> 0);
			width = 1;
			if (r >= 128) {
				_tuple = utf8.DecodeRuneInString(s), r = _tuple[0], width = _tuple[1];
			}
			if ((width === 1) && (r === 65533)) {
				buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\x")));
				buf = go$append(buf, "0123456789abcdef".charCodeAt((s.charCodeAt(0) >>> 4 << 24 >>> 24)));
				buf = go$append(buf, "0123456789abcdef".charCodeAt(((s.charCodeAt(0) & 15) >>> 0)));
				s = s.substring(width);
				continue;
			}
			if ((r === (quote >> 0)) || (r === 92)) {
				buf = go$append(buf, 92);
				buf = go$append(buf, (r << 24 >>> 24));
				s = s.substring(width);
				continue;
			}
			if (ASCIIonly) {
				if (r < 128 && IsPrint(r)) {
					buf = go$append(buf, (r << 24 >>> 24));
					s = s.substring(width);
					continue;
				}
			} else if (IsPrint(r)) {
				n = utf8.EncodeRune(new (go$sliceType(Go$Uint8))(runeTmp), r);
				buf = go$appendSlice(buf, go$subslice(new (go$sliceType(Go$Uint8))(runeTmp), 0, n));
				s = s.substring(width);
				continue;
			}
			_ref = r;
			if (_ref === 7) {
				buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\a")));
			} else if (_ref === 8) {
				buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\b")));
			} else if (_ref === 12) {
				buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\f")));
			} else if (_ref === 10) {
				buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\n")));
			} else if (_ref === 13) {
				buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\r")));
			} else if (_ref === 9) {
				buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\t")));
			} else if (_ref === 11) {
				buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\v")));
			} else {
				if (r < 32) {
					buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\x")));
					buf = go$append(buf, "0123456789abcdef".charCodeAt((s.charCodeAt(0) >>> 4 << 24 >>> 24)));
					buf = go$append(buf, "0123456789abcdef".charCodeAt(((s.charCodeAt(0) & 15) >>> 0)));
				} else if (r > 1114111) {
					r = 65533;
					buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\u")));
					s$1 = 12;
					while (s$1 >= 0) {
						buf = go$append(buf, "0123456789abcdef".charCodeAt((((r >> go$min((s$1 >>> 0), 31)) >> 0) & 15)));
						s$1 = s$1 - 4 >> 0;
					}
				} else if (r < 65536) {
					buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\u")));
					s$1 = 12;
					while (s$1 >= 0) {
						buf = go$append(buf, "0123456789abcdef".charCodeAt((((r >> go$min((s$1 >>> 0), 31)) >> 0) & 15)));
						s$1 = s$1 - 4 >> 0;
					}
				} else {
					buf = go$appendSlice(buf, new (go$sliceType(Go$Uint8))(go$stringToBytes("\\U")));
					s$2 = 28;
					while (s$2 >= 0) {
						buf = go$append(buf, "0123456789abcdef".charCodeAt((((r >> go$min((s$2 >>> 0), 31)) >> 0) & 15)));
						s$2 = s$2 - 4 >> 0;
					}
				}
			}
			s = s.substring(width);
		}
		buf = go$append(buf, quote);
		return go$bytesToString(buf);
	};
	var Quote = go$pkg.Quote = function(s) {
		return quoteWith(s, 34, false);
	};
	var AppendQuote = go$pkg.AppendQuote = function(dst, s) {
		return go$appendSlice(dst, new (go$sliceType(Go$Uint8))(go$stringToBytes(Quote(s))));
	};
	var QuoteToASCII = go$pkg.QuoteToASCII = function(s) {
		return quoteWith(s, 34, true);
	};
	var AppendQuoteToASCII = go$pkg.AppendQuoteToASCII = function(dst, s) {
		return go$appendSlice(dst, new (go$sliceType(Go$Uint8))(go$stringToBytes(QuoteToASCII(s))));
	};
	var QuoteRune = go$pkg.QuoteRune = function(r) {
		return quoteWith(go$encodeRune(r), 39, false);
	};
	var AppendQuoteRune = go$pkg.AppendQuoteRune = function(dst, r) {
		return go$appendSlice(dst, new (go$sliceType(Go$Uint8))(go$stringToBytes(QuoteRune(r))));
	};
	var QuoteRuneToASCII = go$pkg.QuoteRuneToASCII = function(r) {
		return quoteWith(go$encodeRune(r), 39, true);
	};
	var AppendQuoteRuneToASCII = go$pkg.AppendQuoteRuneToASCII = function(dst, r) {
		return go$appendSlice(dst, new (go$sliceType(Go$Uint8))(go$stringToBytes(QuoteRuneToASCII(r))));
	};
	var CanBackquote = go$pkg.CanBackquote = function(s) {
		var i;
		i = 0;
		while (i < s.length) {
			if ((s.charCodeAt(i) < 32 && !((s.charCodeAt(i) === 9))) || (s.charCodeAt(i) === 96)) {
				return false;
			}
			i = i + 1 >> 0;
		}
		return true;
	};
	var unhex = function(b) {
		var v, ok, c, _tuple, _tuple$1, _tuple$2;
		v = 0;
		ok = false;
		c = (b >> 0);
		if (48 <= c && c <= 57) {
			_tuple = [c - 48 >> 0, true], v = _tuple[0], ok = _tuple[1];
			return [v, ok];
		} else if (97 <= c && c <= 102) {
			_tuple$1 = [(c - 97 >> 0) + 10 >> 0, true], v = _tuple$1[0], ok = _tuple$1[1];
			return [v, ok];
		} else if (65 <= c && c <= 70) {
			_tuple$2 = [(c - 65 >> 0) + 10 >> 0, true], v = _tuple$2[0], ok = _tuple$2[1];
			return [v, ok];
		}
		return [v, ok];
	};
	var UnquoteChar = go$pkg.UnquoteChar = function(s, quote) {
		var value, multibyte, tail, err, c, _tuple, r, size, _tuple$1, _tuple$2, c$1, _ref, n, _ref$1, v, j, _tuple$3, x, ok, v$1, j$1, x$1;
		value = 0;
		multibyte = false;
		tail = "";
		err = null;
		c = s.charCodeAt(0);
		if ((c === quote) && ((quote === 39) || (quote === 34))) {
			err = go$pkg.ErrSyntax;
			return [value, multibyte, tail, err];
		} else if (c >= 128) {
			_tuple = utf8.DecodeRuneInString(s), r = _tuple[0], size = _tuple[1];
			_tuple$1 = [r, true, s.substring(size), null], value = _tuple$1[0], multibyte = _tuple$1[1], tail = _tuple$1[2], err = _tuple$1[3];
			return [value, multibyte, tail, err];
		} else if (!((c === 92))) {
			_tuple$2 = [(s.charCodeAt(0) >> 0), false, s.substring(1), null], value = _tuple$2[0], multibyte = _tuple$2[1], tail = _tuple$2[2], err = _tuple$2[3];
			return [value, multibyte, tail, err];
		}
		if (s.length <= 1) {
			err = go$pkg.ErrSyntax;
			return [value, multibyte, tail, err];
		}
		c$1 = s.charCodeAt(1);
		s = s.substring(2);
		_ref = c$1;
		switch (0) { default: if (_ref === 97) {
			value = 7;
		} else if (_ref === 98) {
			value = 8;
		} else if (_ref === 102) {
			value = 12;
		} else if (_ref === 110) {
			value = 10;
		} else if (_ref === 114) {
			value = 13;
		} else if (_ref === 116) {
			value = 9;
		} else if (_ref === 118) {
			value = 11;
		} else if (_ref === 120 || _ref === 117 || _ref === 85) {
			n = 0;
			_ref$1 = c$1;
			if (_ref$1 === 120) {
				n = 2;
			} else if (_ref$1 === 117) {
				n = 4;
			} else if (_ref$1 === 85) {
				n = 8;
			}
			v = 0;
			if (s.length < n) {
				err = go$pkg.ErrSyntax;
				return [value, multibyte, tail, err];
			}
			j = 0;
			while (j < n) {
				_tuple$3 = unhex(s.charCodeAt(j)), x = _tuple$3[0], ok = _tuple$3[1];
				if (!ok) {
					err = go$pkg.ErrSyntax;
					return [value, multibyte, tail, err];
				}
				v = (v << 4 >> 0) | x;
				j = j + 1 >> 0;
			}
			s = s.substring(n);
			if (c$1 === 120) {
				value = v;
				break;
			}
			if (v > 1114111) {
				err = go$pkg.ErrSyntax;
				return [value, multibyte, tail, err];
			}
			value = v;
			multibyte = true;
		} else if (_ref === 48 || _ref === 49 || _ref === 50 || _ref === 51 || _ref === 52 || _ref === 53 || _ref === 54 || _ref === 55) {
			v$1 = (c$1 >> 0) - 48 >> 0;
			if (s.length < 2) {
				err = go$pkg.ErrSyntax;
				return [value, multibyte, tail, err];
			}
			j$1 = 0;
			while (j$1 < 2) {
				x$1 = (s.charCodeAt(j$1) >> 0) - 48 >> 0;
				if (x$1 < 0 || x$1 > 7) {
					err = go$pkg.ErrSyntax;
					return [value, multibyte, tail, err];
				}
				v$1 = ((v$1 << 3 >> 0)) | x$1;
				j$1 = j$1 + 1 >> 0;
			}
			s = s.substring(2);
			if (v$1 > 255) {
				err = go$pkg.ErrSyntax;
				return [value, multibyte, tail, err];
			}
			value = v$1;
		} else if (_ref === 92) {
			value = 92;
		} else if (_ref === 39 || _ref === 34) {
			if (!((c$1 === quote))) {
				err = go$pkg.ErrSyntax;
				return [value, multibyte, tail, err];
			}
			value = (c$1 >> 0);
		} else {
			err = go$pkg.ErrSyntax;
			return [value, multibyte, tail, err];
		} }
		tail = s;
		return [value, multibyte, tail, err];
	};
	var Unquote = go$pkg.Unquote = function(s) {
		var t, err, n, _tuple, quote, _tuple$1, _tuple$2, _tuple$3, _tuple$4, _tuple$5, _ref, _tuple$6, _tuple$7, r, size, _tuple$8, runeTmp, _q, x, x$1, buf, _tuple$9, c, multibyte, ss, err$1, _tuple$10, n$1, _tuple$11, _tuple$12;
		t = "";
		err = null;
		n = s.length;
		if (n < 2) {
			_tuple = ["", go$pkg.ErrSyntax], t = _tuple[0], err = _tuple[1];
			return [t, err];
		}
		quote = s.charCodeAt(0);
		if (!((quote === s.charCodeAt((n - 1 >> 0))))) {
			_tuple$1 = ["", go$pkg.ErrSyntax], t = _tuple$1[0], err = _tuple$1[1];
			return [t, err];
		}
		s = s.substring(1, (n - 1 >> 0));
		if (quote === 96) {
			if (contains(s, 96)) {
				_tuple$2 = ["", go$pkg.ErrSyntax], t = _tuple$2[0], err = _tuple$2[1];
				return [t, err];
			}
			_tuple$3 = [s, null], t = _tuple$3[0], err = _tuple$3[1];
			return [t, err];
		}
		if (!((quote === 34)) && !((quote === 39))) {
			_tuple$4 = ["", go$pkg.ErrSyntax], t = _tuple$4[0], err = _tuple$4[1];
			return [t, err];
		}
		if (contains(s, 10)) {
			_tuple$5 = ["", go$pkg.ErrSyntax], t = _tuple$5[0], err = _tuple$5[1];
			return [t, err];
		}
		if (!contains(s, 92) && !contains(s, quote)) {
			_ref = quote;
			if (_ref === 34) {
				_tuple$6 = [s, null], t = _tuple$6[0], err = _tuple$6[1];
				return [t, err];
			} else if (_ref === 39) {
				_tuple$7 = utf8.DecodeRuneInString(s), r = _tuple$7[0], size = _tuple$7[1];
				if ((size === s.length) && (!((r === 65533)) || !((size === 1)))) {
					_tuple$8 = [s, null], t = _tuple$8[0], err = _tuple$8[1];
					return [t, err];
				}
			}
		}
		runeTmp = go$makeNativeArray("Uint8", 4, function() { return 0; });
		buf = (go$sliceType(Go$Uint8)).make(0, (_q = (x = 3, x$1 = s.length, (((x >>> 16 << 16) * x$1 >> 0) + (x << 16 >>> 16) * x$1) >> 0) / 2, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero")), function() { return 0; });
		while (s.length > 0) {
			_tuple$9 = UnquoteChar(s, quote), c = _tuple$9[0], multibyte = _tuple$9[1], ss = _tuple$9[2], err$1 = _tuple$9[3];
			if (!(go$interfaceIsEqual(err$1, null))) {
				_tuple$10 = ["", err$1], t = _tuple$10[0], err = _tuple$10[1];
				return [t, err];
			}
			s = ss;
			if (c < 128 || !multibyte) {
				buf = go$append(buf, (c << 24 >>> 24));
			} else {
				n$1 = utf8.EncodeRune(new (go$sliceType(Go$Uint8))(runeTmp), c);
				buf = go$appendSlice(buf, go$subslice(new (go$sliceType(Go$Uint8))(runeTmp), 0, n$1));
			}
			if ((quote === 39) && !((s.length === 0))) {
				_tuple$11 = ["", go$pkg.ErrSyntax], t = _tuple$11[0], err = _tuple$11[1];
				return [t, err];
			}
		}
		_tuple$12 = [go$bytesToString(buf), null], t = _tuple$12[0], err = _tuple$12[1];
		return [t, err];
	};
	var contains = function(s, c) {
		var i;
		i = 0;
		while (i < s.length) {
			if (s.charCodeAt(i) === c) {
				return true;
			}
			i = i + 1 >> 0;
		}
		return false;
	};
	var bsearch16 = function(a, x) {
		var _tuple, i, j, _q, h, _slice, _index;
		_tuple = [0, a.length], i = _tuple[0], j = _tuple[1];
		while (i < j) {
			h = i + (_q = ((j - i >> 0)) / 2, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero")) >> 0;
			if ((_slice = a, _index = h, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) < x) {
				i = h + 1 >> 0;
			} else {
				j = h;
			}
		}
		return i;
	};
	var bsearch32 = function(a, x) {
		var _tuple, i, j, _q, h, _slice, _index;
		_tuple = [0, a.length], i = _tuple[0], j = _tuple[1];
		while (i < j) {
			h = i + (_q = ((j - i >> 0)) / 2, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero")) >> 0;
			if ((_slice = a, _index = h, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) < x) {
				i = h + 1 >> 0;
			} else {
				j = h;
			}
		}
		return i;
	};
	var IsPrint = go$pkg.IsPrint = function(r) {
		var _tuple, rr, isPrint, isNotPrint, i, _slice, _index, _slice$1, _index$1, j, _slice$2, _index$2, _tuple$1, rr$1, isPrint$1, isNotPrint$1, i$1, _slice$3, _index$3, _slice$4, _index$4, j$1, _slice$5, _index$5;
		if (r <= 255) {
			if (32 <= r && r <= 126) {
				return true;
			}
			if (161 <= r && r <= 255) {
				return !((r === 173));
			}
			return false;
		}
		if (0 <= r && r < 65536) {
			_tuple = [(r << 16 >>> 16), isPrint16, isNotPrint16], rr = _tuple[0], isPrint = _tuple[1], isNotPrint = _tuple[2];
			i = bsearch16(isPrint, rr);
			if (i >= isPrint.length || rr < (_slice = isPrint, _index = (i & ~1), (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) || (_slice$1 = isPrint, _index$1 = (i | 1), (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")) < rr) {
				return false;
			}
			j = bsearch16(isNotPrint, rr);
			return j >= isNotPrint.length || !(((_slice$2 = isNotPrint, _index$2 = j, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")) === rr));
		}
		_tuple$1 = [(r >>> 0), isPrint32, isNotPrint32], rr$1 = _tuple$1[0], isPrint$1 = _tuple$1[1], isNotPrint$1 = _tuple$1[2];
		i$1 = bsearch32(isPrint$1, rr$1);
		if (i$1 >= isPrint$1.length || rr$1 < (_slice$3 = isPrint$1, _index$3 = (i$1 & ~1), (_index$3 >= 0 && _index$3 < _slice$3.length) ? _slice$3.array[_slice$3.offset + _index$3] : go$throwRuntimeError("index out of range")) || (_slice$4 = isPrint$1, _index$4 = (i$1 | 1), (_index$4 >= 0 && _index$4 < _slice$4.length) ? _slice$4.array[_slice$4.offset + _index$4] : go$throwRuntimeError("index out of range")) < rr$1) {
			return false;
		}
		if (r >= 131072) {
			return true;
		}
		r = r - 65536 >> 0;
		j$1 = bsearch16(isNotPrint$1, (r << 16 >>> 16));
		return j$1 >= isNotPrint$1.length || !(((_slice$5 = isNotPrint$1, _index$5 = j$1, (_index$5 >= 0 && _index$5 < _slice$5.length) ? _slice$5.array[_slice$5.offset + _index$5] : go$throwRuntimeError("index out of range")) === (r << 16 >>> 16)));
	};
	go$pkg.init = function() {
		optimize = true;
		powtab = new (go$sliceType(Go$Int))([1, 3, 6, 9, 13, 16, 19, 23, 26]);
		float64pow10 = new (go$sliceType(Go$Float64))([1, 10, 100, 1000, 10000, 100000, 1e+06, 1e+07, 1e+08, 1e+09, 1e+10, 1e+11, 1e+12, 1e+13, 1e+14, 1e+15, 1e+16, 1e+17, 1e+18, 1e+19, 1e+20, 1e+21, 1e+22]);
		float32pow10 = new (go$sliceType(Go$Float32))([1, 10, 100, 1000, 10000, 100000, 1e+06, 1e+07, 1e+08, 1e+09, 1e+10]);
		go$pkg.ErrRange = errors.New("value out of range");
		go$pkg.ErrSyntax = errors.New("invalid syntax");
		leftcheats = new (go$sliceType(leftCheat))([new leftCheat.Ptr(0, ""), new leftCheat.Ptr(1, "5"), new leftCheat.Ptr(1, "25"), new leftCheat.Ptr(1, "125"), new leftCheat.Ptr(2, "625"), new leftCheat.Ptr(2, "3125"), new leftCheat.Ptr(2, "15625"), new leftCheat.Ptr(3, "78125"), new leftCheat.Ptr(3, "390625"), new leftCheat.Ptr(3, "1953125"), new leftCheat.Ptr(4, "9765625"), new leftCheat.Ptr(4, "48828125"), new leftCheat.Ptr(4, "244140625"), new leftCheat.Ptr(4, "1220703125"), new leftCheat.Ptr(5, "6103515625"), new leftCheat.Ptr(5, "30517578125"), new leftCheat.Ptr(5, "152587890625"), new leftCheat.Ptr(6, "762939453125"), new leftCheat.Ptr(6, "3814697265625"), new leftCheat.Ptr(6, "19073486328125"), new leftCheat.Ptr(7, "95367431640625"), new leftCheat.Ptr(7, "476837158203125"), new leftCheat.Ptr(7, "2384185791015625"), new leftCheat.Ptr(7, "11920928955078125"), new leftCheat.Ptr(8, "59604644775390625"), new leftCheat.Ptr(8, "298023223876953125"), new leftCheat.Ptr(8, "1490116119384765625"), new leftCheat.Ptr(9, "7450580596923828125")]);
		smallPowersOfTen = go$toNativeArray("Struct", [new extFloat.Ptr(new Go$Uint64(2147483648, 0), -63, false), new extFloat.Ptr(new Go$Uint64(2684354560, 0), -60, false), new extFloat.Ptr(new Go$Uint64(3355443200, 0), -57, false), new extFloat.Ptr(new Go$Uint64(4194304000, 0), -54, false), new extFloat.Ptr(new Go$Uint64(2621440000, 0), -50, false), new extFloat.Ptr(new Go$Uint64(3276800000, 0), -47, false), new extFloat.Ptr(new Go$Uint64(4096000000, 0), -44, false), new extFloat.Ptr(new Go$Uint64(2560000000, 0), -40, false)]);
		powersOfTen = go$toNativeArray("Struct", [new extFloat.Ptr(new Go$Uint64(4203730336, 136053384), -1220, false), new extFloat.Ptr(new Go$Uint64(3132023167, 2722021238), -1193, false), new extFloat.Ptr(new Go$Uint64(2333539104, 810921078), -1166, false), new extFloat.Ptr(new Go$Uint64(3477244234, 1573795306), -1140, false), new extFloat.Ptr(new Go$Uint64(2590748842, 1432697645), -1113, false), new extFloat.Ptr(new Go$Uint64(3860516611, 1025131999), -1087, false), new extFloat.Ptr(new Go$Uint64(2876309015, 3348809418), -1060, false), new extFloat.Ptr(new Go$Uint64(4286034428, 3200048207), -1034, false), new extFloat.Ptr(new Go$Uint64(3193344495, 1097586188), -1007, false), new extFloat.Ptr(new Go$Uint64(2379227053, 2424306748), -980, false), new extFloat.Ptr(new Go$Uint64(3545324584, 827693699), -954, false), new extFloat.Ptr(new Go$Uint64(2641472655, 2913388981), -927, false), new extFloat.Ptr(new Go$Uint64(3936100983, 602835915), -901, false), new extFloat.Ptr(new Go$Uint64(2932623761, 1081627501), -874, false), new extFloat.Ptr(new Go$Uint64(2184974969, 1572261463), -847, false), new extFloat.Ptr(new Go$Uint64(3255866422, 1308317239), -821, false), new extFloat.Ptr(new Go$Uint64(2425809519, 944281679), -794, false), new extFloat.Ptr(new Go$Uint64(3614737867, 629291719), -768, false), new extFloat.Ptr(new Go$Uint64(2693189581, 2545915892), -741, false), new extFloat.Ptr(new Go$Uint64(4013165208, 388672741), -715, false), new extFloat.Ptr(new Go$Uint64(2990041083, 708162190), -688, false), new extFloat.Ptr(new Go$Uint64(2227754207, 3536207675), -661, false), new extFloat.Ptr(new Go$Uint64(3319612455, 450088378), -635, false), new extFloat.Ptr(new Go$Uint64(2473304014, 3139815830), -608, false), new extFloat.Ptr(new Go$Uint64(3685510180, 2103616900), -582, false), new extFloat.Ptr(new Go$Uint64(2745919064, 224385782), -555, false), new extFloat.Ptr(new Go$Uint64(4091738259, 3737383206), -529, false), new extFloat.Ptr(new Go$Uint64(3048582568, 2868871352), -502, false), new extFloat.Ptr(new Go$Uint64(2271371013, 1820084875), -475, false), new extFloat.Ptr(new Go$Uint64(3384606560, 885076051), -449, false), new extFloat.Ptr(new Go$Uint64(2521728396, 2444895829), -422, false), new extFloat.Ptr(new Go$Uint64(3757668132, 1881767613), -396, false), new extFloat.Ptr(new Go$Uint64(2799680927, 3102062735), -369, false), new extFloat.Ptr(new Go$Uint64(4171849679, 2289335700), -343, false), new extFloat.Ptr(new Go$Uint64(3108270227, 2410191823), -316, false), new extFloat.Ptr(new Go$Uint64(2315841784, 3205436779), -289, false), new extFloat.Ptr(new Go$Uint64(3450873173, 1697722806), -263, false), new extFloat.Ptr(new Go$Uint64(2571100870, 3497754540), -236, false), new extFloat.Ptr(new Go$Uint64(3831238852, 707476230), -210, false), new extFloat.Ptr(new Go$Uint64(2854495385, 1769181907), -183, false), new extFloat.Ptr(new Go$Uint64(4253529586, 2197867022), -157, false), new extFloat.Ptr(new Go$Uint64(3169126500, 2450594539), -130, false), new extFloat.Ptr(new Go$Uint64(2361183241, 1867548876), -103, false), new extFloat.Ptr(new Go$Uint64(3518437208, 3793315116), -77, false), new extFloat.Ptr(new Go$Uint64(2621440000, 0), -50, false), new extFloat.Ptr(new Go$Uint64(3906250000, 0), -24, false), new extFloat.Ptr(new Go$Uint64(2910383045, 2892103680), 3, false), new extFloat.Ptr(new Go$Uint64(2168404344, 4170451332), 30, false), new extFloat.Ptr(new Go$Uint64(3231174267, 3372684723), 56, false), new extFloat.Ptr(new Go$Uint64(2407412430, 2078956656), 83, false), new extFloat.Ptr(new Go$Uint64(3587324068, 2884206696), 109, false), new extFloat.Ptr(new Go$Uint64(2672764710, 395977285), 136, false), new extFloat.Ptr(new Go$Uint64(3982729777, 3569679143), 162, false), new extFloat.Ptr(new Go$Uint64(2967364920, 2361961896), 189, false), new extFloat.Ptr(new Go$Uint64(2210859150, 447440347), 216, false), new extFloat.Ptr(new Go$Uint64(3294436857, 1114709402), 242, false), new extFloat.Ptr(new Go$Uint64(2454546732, 2786846552), 269, false), new extFloat.Ptr(new Go$Uint64(3657559652, 443583978), 295, false), new extFloat.Ptr(new Go$Uint64(2725094297, 2599384906), 322, false), new extFloat.Ptr(new Go$Uint64(4060706939, 3028118405), 348, false), new extFloat.Ptr(new Go$Uint64(3025462433, 2044532855), 375, false), new extFloat.Ptr(new Go$Uint64(2254145170, 1536935362), 402, false), new extFloat.Ptr(new Go$Uint64(3358938053, 3365297469), 428, false), new extFloat.Ptr(new Go$Uint64(2502603868, 4204241075), 455, false), new extFloat.Ptr(new Go$Uint64(3729170365, 2577424355), 481, false), new extFloat.Ptr(new Go$Uint64(2778448436, 3677981733), 508, false), new extFloat.Ptr(new Go$Uint64(4140210802, 2744688476), 534, false), new extFloat.Ptr(new Go$Uint64(3084697427, 1424604878), 561, false), new extFloat.Ptr(new Go$Uint64(2298278679, 4062331362), 588, false), new extFloat.Ptr(new Go$Uint64(3424702107, 3546052773), 614, false), new extFloat.Ptr(new Go$Uint64(2551601907, 2065781727), 641, false), new extFloat.Ptr(new Go$Uint64(3802183132, 2535403578), 667, false), new extFloat.Ptr(new Go$Uint64(2832847187, 1558426518), 694, false), new extFloat.Ptr(new Go$Uint64(4221271257, 2762425404), 720, false), new extFloat.Ptr(new Go$Uint64(3145092172, 2812560400), 747, false), new extFloat.Ptr(new Go$Uint64(2343276271, 3057687578), 774, false), new extFloat.Ptr(new Go$Uint64(3491753744, 2790753324), 800, false), new extFloat.Ptr(new Go$Uint64(2601559269, 3918606633), 827, false), new extFloat.Ptr(new Go$Uint64(3876625403, 2711358621), 853, false), new extFloat.Ptr(new Go$Uint64(2888311001, 1648096297), 880, false), new extFloat.Ptr(new Go$Uint64(2151959390, 2057817989), 907, false), new extFloat.Ptr(new Go$Uint64(3206669376, 61660461), 933, false), new extFloat.Ptr(new Go$Uint64(2389154863, 1581580175), 960, false), new extFloat.Ptr(new Go$Uint64(3560118173, 2626467905), 986, false), new extFloat.Ptr(new Go$Uint64(2652494738, 3034782633), 1013, false), new extFloat.Ptr(new Go$Uint64(3952525166, 3135207385), 1039, false), new extFloat.Ptr(new Go$Uint64(2944860731, 2616258155), 1066, false)]);
		uint64pow10 = go$toNativeArray("Uint64", [new Go$Uint64(0, 1), new Go$Uint64(0, 10), new Go$Uint64(0, 100), new Go$Uint64(0, 1000), new Go$Uint64(0, 10000), new Go$Uint64(0, 100000), new Go$Uint64(0, 1000000), new Go$Uint64(0, 10000000), new Go$Uint64(0, 100000000), new Go$Uint64(0, 1000000000), new Go$Uint64(2, 1410065408), new Go$Uint64(23, 1215752192), new Go$Uint64(232, 3567587328), new Go$Uint64(2328, 1316134912), new Go$Uint64(23283, 276447232), new Go$Uint64(232830, 2764472320), new Go$Uint64(2328306, 1874919424), new Go$Uint64(23283064, 1569325056), new Go$Uint64(232830643, 2808348672), new Go$Uint64(2328306436, 2313682944)]);
		float32info = new floatInfo.Ptr(23, 8, -127);
		float64info = new floatInfo.Ptr(52, 11, -1023);
		isPrint16 = new (go$sliceType(Go$Uint16))([32, 126, 161, 887, 890, 894, 900, 1319, 1329, 1366, 1369, 1418, 1423, 1479, 1488, 1514, 1520, 1524, 1542, 1563, 1566, 1805, 1808, 1866, 1869, 1969, 1984, 2042, 2048, 2093, 2096, 2139, 2142, 2142, 2208, 2220, 2276, 2444, 2447, 2448, 2451, 2482, 2486, 2489, 2492, 2500, 2503, 2504, 2507, 2510, 2519, 2519, 2524, 2531, 2534, 2555, 2561, 2570, 2575, 2576, 2579, 2617, 2620, 2626, 2631, 2632, 2635, 2637, 2641, 2641, 2649, 2654, 2662, 2677, 2689, 2745, 2748, 2765, 2768, 2768, 2784, 2787, 2790, 2801, 2817, 2828, 2831, 2832, 2835, 2873, 2876, 2884, 2887, 2888, 2891, 2893, 2902, 2903, 2908, 2915, 2918, 2935, 2946, 2954, 2958, 2965, 2969, 2975, 2979, 2980, 2984, 2986, 2990, 3001, 3006, 3010, 3014, 3021, 3024, 3024, 3031, 3031, 3046, 3066, 3073, 3129, 3133, 3149, 3157, 3161, 3168, 3171, 3174, 3183, 3192, 3199, 3202, 3257, 3260, 3277, 3285, 3286, 3294, 3299, 3302, 3314, 3330, 3386, 3389, 3406, 3415, 3415, 3424, 3427, 3430, 3445, 3449, 3455, 3458, 3478, 3482, 3517, 3520, 3526, 3530, 3530, 3535, 3551, 3570, 3572, 3585, 3642, 3647, 3675, 3713, 3716, 3719, 3722, 3725, 3725, 3732, 3751, 3754, 3773, 3776, 3789, 3792, 3801, 3804, 3807, 3840, 3948, 3953, 4058, 4096, 4295, 4301, 4301, 4304, 4685, 4688, 4701, 4704, 4749, 4752, 4789, 4792, 4805, 4808, 4885, 4888, 4954, 4957, 4988, 4992, 5017, 5024, 5108, 5120, 5788, 5792, 5872, 5888, 5908, 5920, 5942, 5952, 5971, 5984, 6003, 6016, 6109, 6112, 6121, 6128, 6137, 6144, 6157, 6160, 6169, 6176, 6263, 6272, 6314, 6320, 6389, 6400, 6428, 6432, 6443, 6448, 6459, 6464, 6464, 6468, 6509, 6512, 6516, 6528, 6571, 6576, 6601, 6608, 6618, 6622, 6683, 6686, 6780, 6783, 6793, 6800, 6809, 6816, 6829, 6912, 6987, 6992, 7036, 7040, 7155, 7164, 7223, 7227, 7241, 7245, 7295, 7360, 7367, 7376, 7414, 7424, 7654, 7676, 7957, 7960, 7965, 7968, 8005, 8008, 8013, 8016, 8061, 8064, 8147, 8150, 8175, 8178, 8190, 8208, 8231, 8240, 8286, 8304, 8305, 8308, 8348, 8352, 8378, 8400, 8432, 8448, 8585, 8592, 9203, 9216, 9254, 9280, 9290, 9312, 11084, 11088, 11097, 11264, 11507, 11513, 11559, 11565, 11565, 11568, 11623, 11631, 11632, 11647, 11670, 11680, 11835, 11904, 12019, 12032, 12245, 12272, 12283, 12289, 12438, 12441, 12543, 12549, 12589, 12593, 12730, 12736, 12771, 12784, 19893, 19904, 40908, 40960, 42124, 42128, 42182, 42192, 42539, 42560, 42647, 42655, 42743, 42752, 42899, 42912, 42922, 43000, 43051, 43056, 43065, 43072, 43127, 43136, 43204, 43214, 43225, 43232, 43259, 43264, 43347, 43359, 43388, 43392, 43481, 43486, 43487, 43520, 43574, 43584, 43597, 43600, 43609, 43612, 43643, 43648, 43714, 43739, 43766, 43777, 43782, 43785, 43790, 43793, 43798, 43808, 43822, 43968, 44013, 44016, 44025, 44032, 55203, 55216, 55238, 55243, 55291, 63744, 64109, 64112, 64217, 64256, 64262, 64275, 64279, 64285, 64449, 64467, 64831, 64848, 64911, 64914, 64967, 65008, 65021, 65024, 65049, 65056, 65062, 65072, 65131, 65136, 65276, 65281, 65470, 65474, 65479, 65482, 65487, 65490, 65495, 65498, 65500, 65504, 65518, 65532, 65533]);
		isNotPrint16 = new (go$sliceType(Go$Uint16))([173, 907, 909, 930, 1376, 1416, 1424, 1757, 2111, 2209, 2303, 2424, 2432, 2436, 2473, 2481, 2526, 2564, 2601, 2609, 2612, 2615, 2621, 2653, 2692, 2702, 2706, 2729, 2737, 2740, 2758, 2762, 2820, 2857, 2865, 2868, 2910, 2948, 2961, 2971, 2973, 3017, 3076, 3085, 3089, 3113, 3124, 3141, 3145, 3159, 3204, 3213, 3217, 3241, 3252, 3269, 3273, 3295, 3312, 3332, 3341, 3345, 3397, 3401, 3460, 3506, 3516, 3541, 3543, 3715, 3721, 3736, 3744, 3748, 3750, 3756, 3770, 3781, 3783, 3912, 3992, 4029, 4045, 4294, 4681, 4695, 4697, 4745, 4785, 4799, 4801, 4823, 4881, 5760, 5901, 5997, 6001, 6751, 8024, 8026, 8028, 8030, 8117, 8133, 8156, 8181, 8335, 9984, 11311, 11359, 11558, 11687, 11695, 11703, 11711, 11719, 11727, 11735, 11743, 11930, 12352, 12687, 12831, 13055, 42895, 43470, 43815, 64311, 64317, 64319, 64322, 64325, 65107, 65127, 65141, 65511]);
		isPrint32 = new (go$sliceType(Go$Uint32))([65536, 65613, 65616, 65629, 65664, 65786, 65792, 65794, 65799, 65843, 65847, 65930, 65936, 65947, 66000, 66045, 66176, 66204, 66208, 66256, 66304, 66339, 66352, 66378, 66432, 66499, 66504, 66517, 66560, 66717, 66720, 66729, 67584, 67589, 67592, 67640, 67644, 67644, 67647, 67679, 67840, 67867, 67871, 67897, 67903, 67903, 67968, 68023, 68030, 68031, 68096, 68102, 68108, 68147, 68152, 68154, 68159, 68167, 68176, 68184, 68192, 68223, 68352, 68405, 68409, 68437, 68440, 68466, 68472, 68479, 68608, 68680, 69216, 69246, 69632, 69709, 69714, 69743, 69760, 69825, 69840, 69864, 69872, 69881, 69888, 69955, 70016, 70088, 70096, 70105, 71296, 71351, 71360, 71369, 73728, 74606, 74752, 74850, 74864, 74867, 77824, 78894, 92160, 92728, 93952, 94020, 94032, 94078, 94095, 94111, 110592, 110593, 118784, 119029, 119040, 119078, 119081, 119154, 119163, 119261, 119296, 119365, 119552, 119638, 119648, 119665, 119808, 119967, 119970, 119970, 119973, 119974, 119977, 120074, 120077, 120134, 120138, 120485, 120488, 120779, 120782, 120831, 126464, 126500, 126503, 126523, 126530, 126530, 126535, 126548, 126551, 126564, 126567, 126619, 126625, 126651, 126704, 126705, 126976, 127019, 127024, 127123, 127136, 127150, 127153, 127166, 127169, 127199, 127232, 127242, 127248, 127339, 127344, 127386, 127462, 127490, 127504, 127546, 127552, 127560, 127568, 127569, 127744, 127776, 127792, 127868, 127872, 127891, 127904, 127946, 127968, 127984, 128000, 128252, 128256, 128317, 128320, 128323, 128336, 128359, 128507, 128576, 128581, 128591, 128640, 128709, 128768, 128883, 131072, 173782, 173824, 177972, 177984, 178205, 194560, 195101, 917760, 917999]);
		isNotPrint32 = new (go$sliceType(Go$Uint16))([12, 39, 59, 62, 799, 926, 2057, 2102, 2134, 2564, 2580, 2584, 4285, 4405, 54357, 54429, 54445, 54458, 54460, 54468, 54534, 54549, 54557, 54586, 54591, 54597, 54609, 60932, 60960, 60963, 60968, 60979, 60984, 60986, 61000, 61002, 61004, 61008, 61011, 61016, 61018, 61020, 61022, 61024, 61027, 61035, 61043, 61048, 61053, 61055, 61066, 61092, 61098, 61648, 61743, 62262, 62405, 62527, 62529, 62712]);
		shifts = go$toNativeArray("Uint", [0, 0, 1, 0, 2, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0]);
	};
	return go$pkg;
})();
go$packages["sync/atomic"] = (function() {
	var go$pkg = {};
	var SwapInt32 = go$pkg.SwapInt32 = function(addr, newVal) {
		var value = addr.go$get();
		addr.go$set(newVal);
		return value;
	};
	var SwapInt64 = go$pkg.SwapInt64 = function(addr, newVal) {
		var value = addr.go$get();
		addr.go$set(newVal);
		return value;
	};
	var SwapUint32 = go$pkg.SwapUint32 = function(addr, newVal) {
		var value = addr.go$get();
		addr.go$set(newVal);
		return value;
	};
	var SwapUint64 = go$pkg.SwapUint64 = function(addr, newVal) {
		var value = addr.go$get();
		addr.go$set(newVal);
		return value;
	};
	var SwapUintptr = go$pkg.SwapUintptr = function(addr, newVal) {
		var value = addr.go$get();
		addr.go$set(newVal);
		return value;
	};
	var SwapPointer = go$pkg.SwapPointer = function(addr, newVal) {
		var value = addr.go$get();
		addr.go$set(newVal);
		return value;
	};
	var CompareAndSwapInt32 = go$pkg.CompareAndSwapInt32 = function(addr, oldVal, newVal) {
		if (addr.go$get() === oldVal) {
			addr.go$set(newVal);
			return true;
		}
		return false;
	};
	var CompareAndSwapInt64 = go$pkg.CompareAndSwapInt64 = function(addr, oldVal, newVal) {
		if (addr.go$get() === oldVal) {
			addr.go$set(newVal);
			return true;
		}
		return false;
	};
	var CompareAndSwapUint32 = go$pkg.CompareAndSwapUint32 = function(addr, oldVal, newVal) {
		if (addr.go$get() === oldVal) {
			addr.go$set(newVal);
			return true;
		}
		return false;
	};
	var CompareAndSwapUint64 = go$pkg.CompareAndSwapUint64 = function(addr, oldVal, newVal) {
		if (addr.go$get() === oldVal) {
			addr.go$set(newVal);
			return true;
		}
		return false;
	};
	var CompareAndSwapUintptr = go$pkg.CompareAndSwapUintptr = function(addr, oldVal, newVal) {
		if (addr.go$get() === oldVal) {
			addr.go$set(newVal);
			return true;
		}
		return false;
	};
	var CompareAndSwapPointer = go$pkg.CompareAndSwapPointer = function(addr, oldVal, newVal) {
		if (addr.go$get() === oldVal) {
			addr.go$set(newVal);
			return true;
		}
		return false;
	};
	var AddInt32 = go$pkg.AddInt32 = function(addr, delta) {
		var value = addr.go$get() + delta;
		addr.go$set(value);
		return value;
	};
	var AddUint32 = go$pkg.AddUint32 = function(addr, delta) {
		var value = addr.go$get() + delta;
		addr.go$set(value);
		return value;
	};
	var AddInt64 = go$pkg.AddInt64 = function(addr, delta) {
		var value = addr.go$get();
		value = new value.constructor(value.high + delta.high, value.low + delta.low);
		addr.go$set(value);
		return value;
	};
	var AddUint64 = go$pkg.AddUint64 = function(addr, delta) {
		var value = addr.go$get();
		value = new value.constructor(value.high + delta.high, value.low + delta.low);
		addr.go$set(value);
		return value;
	};
	var AddUintptr = go$pkg.AddUintptr = function(addr, delta) {
		var value = addr.go$get() + delta;
		addr.go$set(value);
		return value;
	};
	var LoadInt32 = go$pkg.LoadInt32 = function(addr) {
		return addr.go$get();
	};
	var LoadInt64 = go$pkg.LoadInt64 = function(addr) {
		return addr.go$get();
	};
	var LoadUint32 = go$pkg.LoadUint32 = function(addr) {
		return addr.go$get();
	};
	var LoadUint64 = go$pkg.LoadUint64 = function(addr) {
		return addr.go$get();
	};
	var LoadUintptr = go$pkg.LoadUintptr = function(addr) {
		return addr.go$get();
	};
	var LoadPointer = go$pkg.LoadPointer = function(addr) {
		return addr.go$get();
	};
	var StoreInt32 = go$pkg.StoreInt32 = function(addr, val) {
		addr.go$set(val);
	};
	var StoreInt64 = go$pkg.StoreInt64 = function(addr, val) {
		addr.go$set(val);
	};
	var StoreUint32 = go$pkg.StoreUint32 = function(addr, val) {
		addr.go$set(val);
	};
	var StoreUint64 = go$pkg.StoreUint64 = function(addr, val) {
		addr.go$set(val);
	};
	var StoreUintptr = go$pkg.StoreUintptr = function(addr, val) {
		addr.go$set(val);
	};
	var StorePointer = go$pkg.StorePointer = function(addr, val) {
		addr.go$set(val);
	};
	var panic64 = function() {
		throw go$panic(new Go$String("sync/atomic: broken 64-bit atomic operations (buggy QEMU)"));
	};
	go$pkg.init = function() {
	};
	return go$pkg;
})();
go$packages["sync"] = (function() {
	var go$pkg = {};
	var atomic = go$packages["sync/atomic"];
	var Cond;
	Cond = go$newType(0, "Struct", "sync.Cond", "Cond", "sync", function(L_, sema_, waiters_, checker_) {
		this.go$val = this;
		this.L = L_ !== undefined ? L_ : null;
		this.sema = sema_ !== undefined ? sema_ : go$makeNativeArray("Uintptr", 3, function() { return 0; });
		this.waiters = waiters_ !== undefined ? waiters_ : 0;
		this.checker = checker_ !== undefined ? checker_ : 0;
	});
	go$pkg.Cond = Cond;
	var copyChecker;
	copyChecker = go$newType(4, "Uintptr", "sync.copyChecker", "copyChecker", "sync", null);
	go$pkg.copyChecker = copyChecker;
	var Mutex;
	Mutex = go$newType(0, "Struct", "sync.Mutex", "Mutex", "sync", function(state_, sema_) {
		this.go$val = this;
		this.state = state_ !== undefined ? state_ : 0;
		this.sema = sema_ !== undefined ? sema_ : 0;
	});
	go$pkg.Mutex = Mutex;
	var Locker;
	Locker = go$newType(0, "Interface", "sync.Locker", "Locker", "sync", null);
	go$pkg.Locker = Locker;
	var Once;
	Once = go$newType(0, "Struct", "sync.Once", "Once", "sync", function(m_, done_) {
		this.go$val = this;
		this.m = m_ !== undefined ? m_ : new Mutex.Ptr();
		this.done = done_ !== undefined ? done_ : 0;
	});
	go$pkg.Once = Once;
	var syncSema;
	syncSema = go$newType(0, "Array", "sync.syncSema", "syncSema", "sync", null);
	go$pkg.syncSema = syncSema;
	var RWMutex;
	RWMutex = go$newType(0, "Struct", "sync.RWMutex", "RWMutex", "sync", function(w_, writerSem_, readerSem_, readerCount_, readerWait_) {
		this.go$val = this;
		this.w = w_ !== undefined ? w_ : new Mutex.Ptr();
		this.writerSem = writerSem_ !== undefined ? writerSem_ : 0;
		this.readerSem = readerSem_ !== undefined ? readerSem_ : 0;
		this.readerCount = readerCount_ !== undefined ? readerCount_ : 0;
		this.readerWait = readerWait_ !== undefined ? readerWait_ : 0;
	});
	go$pkg.RWMutex = RWMutex;
	var rlocker;
	rlocker = go$newType(0, "Struct", "sync.rlocker", "rlocker", "sync", function(w_, writerSem_, readerSem_, readerCount_, readerWait_) {
		this.go$val = this;
		this.w = w_ !== undefined ? w_ : new Mutex.Ptr();
		this.writerSem = writerSem_ !== undefined ? writerSem_ : 0;
		this.readerSem = readerSem_ !== undefined ? readerSem_ : 0;
		this.readerCount = readerCount_ !== undefined ? readerCount_ : 0;
		this.readerWait = readerWait_ !== undefined ? readerWait_ : 0;
	});
	go$pkg.rlocker = rlocker;
	var WaitGroup;
	WaitGroup = go$newType(0, "Struct", "sync.WaitGroup", "WaitGroup", "sync", function(m_, counter_, waiters_, sema_) {
		this.go$val = this;
		this.m = m_ !== undefined ? m_ : new Mutex.Ptr();
		this.counter = counter_ !== undefined ? counter_ : 0;
		this.waiters = waiters_ !== undefined ? waiters_ : 0;
		this.sema = sema_ !== undefined ? sema_ : (go$ptrType(Go$Uint32)).nil;
	});
	go$pkg.WaitGroup = WaitGroup;
	Cond.init([["L", "", Locker, ""], ["sema", "sync", syncSema, ""], ["waiters", "sync", Go$Uint32, ""], ["checker", "sync", copyChecker, ""]]);
	(go$ptrType(Cond)).methods = [["Broadcast", "", [], [], false], ["Signal", "", [], [], false], ["Wait", "", [], [], false], ["signalImpl", "sync", [Go$Bool], [], false]];
	(go$ptrType(copyChecker)).methods = [["check", "sync", [], [], false]];
	Mutex.init([["state", "sync", Go$Int32, ""], ["sema", "sync", Go$Uint32, ""]]);
	(go$ptrType(Mutex)).methods = [["Lock", "", [], [], false], ["Unlock", "", [], [], false]];
	Locker.init([["Lock", "", (go$funcType([], [], false))], ["Unlock", "", (go$funcType([], [], false))]]);
	Once.init([["m", "sync", Mutex, ""], ["done", "sync", Go$Uint32, ""]]);
	(go$ptrType(Once)).methods = [["Do", "", [(go$funcType([], [], false))], [], false]];
	syncSema.init(Go$Uintptr, 3);
	RWMutex.init([["w", "sync", Mutex, ""], ["writerSem", "sync", Go$Uint32, ""], ["readerSem", "sync", Go$Uint32, ""], ["readerCount", "sync", Go$Int32, ""], ["readerWait", "sync", Go$Int32, ""]]);
	(go$ptrType(RWMutex)).methods = [["Lock", "", [], [], false], ["RLock", "", [], [], false], ["RLocker", "", [], [Locker], false], ["RUnlock", "", [], [], false], ["Unlock", "", [], [], false]];
	rlocker.init([["w", "sync", Mutex, ""], ["writerSem", "sync", Go$Uint32, ""], ["readerSem", "sync", Go$Uint32, ""], ["readerCount", "sync", Go$Int32, ""], ["readerWait", "sync", Go$Int32, ""]]);
	(go$ptrType(rlocker)).methods = [["Lock", "", [], [], false], ["Unlock", "", [], [], false]];
	WaitGroup.init([["m", "sync", Mutex, ""], ["counter", "sync", Go$Int32, ""], ["waiters", "sync", Go$Int32, ""], ["sema", "sync", (go$ptrType(Go$Uint32)), ""]]);
	(go$ptrType(WaitGroup)).methods = [["Add", "", [Go$Int], [], false], ["Done", "", [], [], false], ["Wait", "", [], [], false]];
	var NewCond = go$pkg.NewCond = function(l) {
		return new Cond.Ptr(l, go$makeNativeArray("Uintptr", 3, function() { return 0; }), 0, 0);
	};
	Cond.Ptr.prototype.Wait = function() {
		var c, v, v$1;
		c = this;
		(new (go$ptrType(copyChecker))(function() { return c.checker; }, function(v) { c.checker = v; })).check();
		atomic.AddUint32(new (go$ptrType(Go$Uint32))(function() { return c.waiters; }, function(v$1) { c.waiters = v$1; }), 1);
		c.L.Unlock();
		runtime_Syncsemacquire(c.sema);
		c.L.Lock();
	};
	Cond.prototype.Wait = function() { return this.go$val.Wait(); };
	Cond.Ptr.prototype.Signal = function() {
		var c;
		c = this;
		c.signalImpl(false);
	};
	Cond.prototype.Signal = function() { return this.go$val.Signal(); };
	Cond.Ptr.prototype.Broadcast = function() {
		var c;
		c = this;
		c.signalImpl(true);
	};
	Cond.prototype.Broadcast = function() { return this.go$val.Broadcast(); };
	Cond.Ptr.prototype.signalImpl = function(all) {
		var c, v, v$1, old, new$1, v$2;
		c = this;
		(new (go$ptrType(copyChecker))(function() { return c.checker; }, function(v) { c.checker = v; })).check();
		while (true) {
			old = atomic.LoadUint32(new (go$ptrType(Go$Uint32))(function() { return c.waiters; }, function(v$1) { c.waiters = v$1; }));
			if (old === 0) {
				return;
			}
			new$1 = old - 1 >>> 0;
			if (all) {
				new$1 = 0;
			}
			if (atomic.CompareAndSwapUint32(new (go$ptrType(Go$Uint32))(function() { return c.waiters; }, function(v$2) { c.waiters = v$2; }), old, new$1)) {
				runtime_Syncsemrelease(c.sema, old - new$1 >>> 0);
				return;
			}
		}
	};
	Cond.prototype.signalImpl = function(all) { return this.go$val.signalImpl(all); };
	go$ptrType(copyChecker).prototype.check = function() {};
	copyChecker.prototype.check = function() { var obj = this.go$val; return (new (go$ptrType(copyChecker))(function() { return obj; }, null)).check(); };
	Mutex.Ptr.prototype.Lock = function() {
		var m, v, awoke, old, new$1, v$1, v$2;
		m = this;
		if (atomic.CompareAndSwapInt32(new (go$ptrType(Go$Int32))(function() { return m.state; }, function(v) { m.state = v; }), 0, 1)) {
			return;
		}
		awoke = false;
		while (true) {
			old = m.state;
			new$1 = old | 1;
			if (!(((old & 1) === 0))) {
				new$1 = old + 4 >> 0;
			}
			if (awoke) {
				new$1 = new$1 & ~2;
			}
			if (atomic.CompareAndSwapInt32(new (go$ptrType(Go$Int32))(function() { return m.state; }, function(v$1) { m.state = v$1; }), old, new$1)) {
				if ((old & 1) === 0) {
					break;
				}
				runtime_Semacquire(new (go$ptrType(Go$Uint32))(function() { return m.sema; }, function(v$2) { m.sema = v$2; }));
				awoke = true;
			}
		}
	};
	Mutex.prototype.Lock = function() { return this.go$val.Lock(); };
	Mutex.Ptr.prototype.Unlock = function() {
		var m, v, new$1, old, v$1, v$2;
		m = this;
		new$1 = atomic.AddInt32(new (go$ptrType(Go$Int32))(function() { return m.state; }, function(v) { m.state = v; }), -1);
		if ((((new$1 + 1 >> 0)) & 1) === 0) {
			throw go$panic(new Go$String("sync: unlock of unlocked mutex"));
		}
		old = new$1;
		while (true) {
			if (((old >> 2 >> 0) === 0) || !(((old & 3) === 0))) {
				return;
			}
			new$1 = ((old - 4 >> 0)) | 2;
			if (atomic.CompareAndSwapInt32(new (go$ptrType(Go$Int32))(function() { return m.state; }, function(v$1) { m.state = v$1; }), old, new$1)) {
				runtime_Semrelease(new (go$ptrType(Go$Uint32))(function() { return m.sema; }, function(v$2) { m.sema = v$2; }));
				return;
			}
			old = m.state;
		}
	};
	Mutex.prototype.Unlock = function() { return this.go$val.Unlock(); };
	Once.Ptr.prototype.Do = function(f) {
		var o, v, v$1;
		var go$deferred = [];
		try {
			o = this;
			if (atomic.LoadUint32(new (go$ptrType(Go$Uint32))(function() { return o.done; }, function(v) { o.done = v; })) === 1) {
				return;
			}
			o.m.Lock();
			go$deferred.push({ recv: o.m, method: "Unlock", args: [] });
			if (o.done === 0) {
				f();
				atomic.StoreUint32(new (go$ptrType(Go$Uint32))(function() { return o.done; }, function(v$1) { o.done = v$1; }), 1);
			}
		} catch(go$err) {
			go$pushErr(go$err);
		} finally {
			go$callDeferred(go$deferred);
		}
	};
	Once.prototype.Do = function(f) { return this.go$val.Do(f); };
	var raceAcquire = function(addr) {
	};
	var raceRelease = function(addr) {
	};
	var raceReleaseMerge = function(addr) {
	};
	var raceDisable = function() {
	};
	var raceEnable = function() {
	};
	var raceRead = function(addr) {
	};
	var raceWrite = function(addr) {
	};
	var runtime_Semacquire = function(s) {
		throw go$panic("Native function not implemented: runtime_Semacquire");
	};
	var runtime_Semrelease = function(s) {
		throw go$panic("Native function not implemented: runtime_Semrelease");
	};
	var runtime_Syncsemacquire = function(s) {
		throw go$panic("Native function not implemented: runtime_Syncsemacquire");
	};
	var runtime_Syncsemrelease = function(s, n) {
		throw go$panic("Native function not implemented: runtime_Syncsemrelease");
	};
	var runtime_Syncsemcheck = function() {};
	RWMutex.Ptr.prototype.RLock = function() {
		var rw, v, v$1;
		rw = this;
		if (atomic.AddInt32(new (go$ptrType(Go$Int32))(function() { return rw.readerCount; }, function(v) { rw.readerCount = v; }), 1) < 0) {
			runtime_Semacquire(new (go$ptrType(Go$Uint32))(function() { return rw.readerSem; }, function(v$1) { rw.readerSem = v$1; }));
		}
	};
	RWMutex.prototype.RLock = function() { return this.go$val.RLock(); };
	RWMutex.Ptr.prototype.RUnlock = function() {
		var rw, v, v$1, v$2;
		rw = this;
		if (atomic.AddInt32(new (go$ptrType(Go$Int32))(function() { return rw.readerCount; }, function(v) { rw.readerCount = v; }), -1) < 0) {
			if (atomic.AddInt32(new (go$ptrType(Go$Int32))(function() { return rw.readerWait; }, function(v$1) { rw.readerWait = v$1; }), -1) === 0) {
				runtime_Semrelease(new (go$ptrType(Go$Uint32))(function() { return rw.writerSem; }, function(v$2) { rw.writerSem = v$2; }));
			}
		}
	};
	RWMutex.prototype.RUnlock = function() { return this.go$val.RUnlock(); };
	RWMutex.Ptr.prototype.Lock = function() {
		var rw, v, r, v$1, v$2;
		rw = this;
		rw.w.Lock();
		r = atomic.AddInt32(new (go$ptrType(Go$Int32))(function() { return rw.readerCount; }, function(v) { rw.readerCount = v; }), -1073741824) + 1073741824 >> 0;
		if (!((r === 0)) && !((atomic.AddInt32(new (go$ptrType(Go$Int32))(function() { return rw.readerWait; }, function(v$1) { rw.readerWait = v$1; }), r) === 0))) {
			runtime_Semacquire(new (go$ptrType(Go$Uint32))(function() { return rw.writerSem; }, function(v$2) { rw.writerSem = v$2; }));
		}
	};
	RWMutex.prototype.Lock = function() { return this.go$val.Lock(); };
	RWMutex.Ptr.prototype.Unlock = function() {
		var rw, v, r, i, v$1;
		rw = this;
		r = atomic.AddInt32(new (go$ptrType(Go$Int32))(function() { return rw.readerCount; }, function(v) { rw.readerCount = v; }), 1073741824);
		i = 0;
		while (i < (r >> 0)) {
			runtime_Semrelease(new (go$ptrType(Go$Uint32))(function() { return rw.readerSem; }, function(v$1) { rw.readerSem = v$1; }));
			i = i + 1 >> 0;
		}
		rw.w.Unlock();
	};
	RWMutex.prototype.Unlock = function() { return this.go$val.Unlock(); };
	RWMutex.Ptr.prototype.RLocker = function() {
		var rw, _struct, _struct$1;
		rw = this;
		return (_struct = rw, new rlocker.Ptr((_struct$1 = _struct.w, new Mutex.Ptr(_struct$1.state, _struct$1.sema)), _struct.writerSem, _struct.readerSem, _struct.readerCount, _struct.readerWait));
	};
	RWMutex.prototype.RLocker = function() { return this.go$val.RLocker(); };
	rlocker.Ptr.prototype.Lock = function() {
		var r, _struct, _struct$1;
		r = this;
		(_struct = r, new RWMutex.Ptr((_struct$1 = _struct.w, new Mutex.Ptr(_struct$1.state, _struct$1.sema)), _struct.writerSem, _struct.readerSem, _struct.readerCount, _struct.readerWait)).RLock();
	};
	rlocker.prototype.Lock = function() { return this.go$val.Lock(); };
	rlocker.Ptr.prototype.Unlock = function() {
		var r, _struct, _struct$1;
		r = this;
		(_struct = r, new RWMutex.Ptr((_struct$1 = _struct.w, new Mutex.Ptr(_struct$1.state, _struct$1.sema)), _struct.writerSem, _struct.readerSem, _struct.readerCount, _struct.readerWait)).RUnlock();
	};
	rlocker.prototype.Unlock = function() { return this.go$val.Unlock(); };
	WaitGroup.Ptr.prototype.Add = function(delta) {
		var wg, v, v$1, v$2, i;
		var go$deferred = [];
		try {
			wg = this;
			v$1 = atomic.AddInt32(new (go$ptrType(Go$Int32))(function() { return wg.counter; }, function(v) { wg.counter = v; }), (delta >> 0));
			if (v$1 < 0) {
				throw go$panic(new Go$String("sync: negative WaitGroup counter"));
			}
			if (v$1 > 0 || (atomic.LoadInt32(new (go$ptrType(Go$Int32))(function() { return wg.waiters; }, function(v$2) { wg.waiters = v$2; })) === 0)) {
				return;
			}
			wg.m.Lock();
			i = 0;
			while (i < wg.waiters) {
				runtime_Semrelease(wg.sema);
				i = i + 1 >> 0;
			}
			wg.waiters = 0;
			wg.sema = (go$ptrType(Go$Uint32)).nil;
			wg.m.Unlock();
		} catch(go$err) {
			go$pushErr(go$err);
		} finally {
			go$callDeferred(go$deferred);
		}
	};
	WaitGroup.prototype.Add = function(delta) { return this.go$val.Add(delta); };
	WaitGroup.Ptr.prototype.Done = function() {
		var wg;
		wg = this;
		wg.Add(-1);
	};
	WaitGroup.prototype.Done = function() { return this.go$val.Done(); };
	WaitGroup.Ptr.prototype.Wait = function() {
		var wg, v, v$1, w, v$2, v$3, s;
		wg = this;
		if (atomic.LoadInt32(new (go$ptrType(Go$Int32))(function() { return wg.counter; }, function(v) { wg.counter = v; })) === 0) {
			return;
		}
		wg.m.Lock();
		w = atomic.AddInt32(new (go$ptrType(Go$Int32))(function() { return wg.waiters; }, function(v$1) { wg.waiters = v$1; }), 1);
		if (atomic.LoadInt32(new (go$ptrType(Go$Int32))(function() { return wg.counter; }, function(v$2) { wg.counter = v$2; })) === 0) {
			atomic.AddInt32(new (go$ptrType(Go$Int32))(function() { return wg.waiters; }, function(v$3) { wg.waiters = v$3; }), -1);
			wg.m.Unlock();
			return;
		}
		if (go$pointerIsEqual(wg.sema, (go$ptrType(Go$Uint32)).nil)) {
			wg.sema = go$newDataPointer(0, (go$ptrType(Go$Uint32)));
		}
		s = wg.sema;
		wg.m.Unlock();
		runtime_Semacquire(s);
	};
	WaitGroup.prototype.Wait = function() { return this.go$val.Wait(); };
	go$pkg.init = function() {
		var s;
		s = go$makeNativeArray("Uintptr", 3, function() { return 0; });
		runtime_Syncsemcheck(12);
	};
	return go$pkg;
})();
go$packages["unicode/utf16"] = (function() {
	var go$pkg = {};
	var IsSurrogate = go$pkg.IsSurrogate = function(r) {
		return 55296 <= r && r < 57344;
	};
	var DecodeRune = go$pkg.DecodeRune = function(r1, r2) {
		if (55296 <= r1 && r1 < 56320 && 56320 <= r2 && r2 < 57344) {
			return ((((r1 - 55296 >> 0)) << 10 >> 0) | ((r2 - 56320 >> 0))) + 65536 >> 0;
		}
		return 65533;
	};
	var EncodeRune = go$pkg.EncodeRune = function(r) {
		var r1, r2, _tuple, _tuple$1;
		r1 = 0;
		r2 = 0;
		if (r < 65536 || r > 1114111 || IsSurrogate(r)) {
			_tuple = [65533, 65533], r1 = _tuple[0], r2 = _tuple[1];
			return [r1, r2];
		}
		r = r - 65536 >> 0;
		_tuple$1 = [55296 + (((r >> 10 >> 0)) & 1023) >> 0, 56320 + (r & 1023) >> 0], r1 = _tuple$1[0], r2 = _tuple$1[1];
		return [r1, r2];
	};
	var Encode = go$pkg.Encode = function(s) {
		var n, _ref, _i, _slice, _index, v, a, _ref$1, _i$1, _slice$1, _index$1, v$1, _slice$2, _index$2, _slice$3, _index$3, _tuple, r1, r2, _slice$4, _index$4, _slice$5, _index$5;
		n = s.length;
		_ref = s;
		_i = 0;
		while (_i < _ref.length) {
			v = (_slice = _ref, _index = _i, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range"));
			if (v >= 65536) {
				n = n + 1 >> 0;
			}
			_i++;
		}
		a = (go$sliceType(Go$Uint16)).make(n, 0, function() { return 0; });
		n = 0;
		_ref$1 = s;
		_i$1 = 0;
		while (_i$1 < _ref$1.length) {
			v$1 = (_slice$1 = _ref$1, _index$1 = _i$1, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range"));
			if (v$1 < 0 || 55296 <= v$1 && v$1 < 57344 || v$1 > 1114111) {
				v$1 = 65533;
				_slice$2 = a, _index$2 = n, (_index$2 >= 0 && _index$2 < _slice$2.length) ? (_slice$2.array[_slice$2.offset + _index$2] = (v$1 << 16 >>> 16)) : go$throwRuntimeError("index out of range");
				n = n + 1 >> 0;
			} else if (v$1 < 65536) {
				_slice$3 = a, _index$3 = n, (_index$3 >= 0 && _index$3 < _slice$3.length) ? (_slice$3.array[_slice$3.offset + _index$3] = (v$1 << 16 >>> 16)) : go$throwRuntimeError("index out of range");
				n = n + 1 >> 0;
			} else {
				_tuple = EncodeRune(v$1), r1 = _tuple[0], r2 = _tuple[1];
				_slice$4 = a, _index$4 = n, (_index$4 >= 0 && _index$4 < _slice$4.length) ? (_slice$4.array[_slice$4.offset + _index$4] = (r1 << 16 >>> 16)) : go$throwRuntimeError("index out of range");
				_slice$5 = a, _index$5 = n + 1 >> 0, (_index$5 >= 0 && _index$5 < _slice$5.length) ? (_slice$5.array[_slice$5.offset + _index$5] = (r2 << 16 >>> 16)) : go$throwRuntimeError("index out of range");
				n = n + 2 >> 0;
			}
			_i$1++;
		}
		return go$subslice(a, 0, n);
	};
	var Decode = go$pkg.Decode = function(s) {
		var a, n, i, _slice, _index, r, _slice$1, _index$1, _slice$2, _index$2, _slice$3, _index$3, _slice$4, _index$4, _slice$5, _index$5, _slice$6, _index$6;
		a = (go$sliceType(Go$Int32)).make(s.length, 0, function() { return 0; });
		n = 0;
		i = 0;
		while (i < s.length) {
			r = (_slice = s, _index = i, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range"));
			if (55296 <= r && r < 56320 && (i + 1 >> 0) < s.length && 56320 <= (_slice$1 = s, _index$1 = (i + 1 >> 0), (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")) && (_slice$2 = s, _index$2 = (i + 1 >> 0), (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")) < 57344) {
				_slice$4 = a, _index$4 = n, (_index$4 >= 0 && _index$4 < _slice$4.length) ? (_slice$4.array[_slice$4.offset + _index$4] = DecodeRune((r >> 0), ((_slice$3 = s, _index$3 = (i + 1 >> 0), (_index$3 >= 0 && _index$3 < _slice$3.length) ? _slice$3.array[_slice$3.offset + _index$3] : go$throwRuntimeError("index out of range")) >> 0))) : go$throwRuntimeError("index out of range");
				i = i + 1 >> 0;
				n = n + 1 >> 0;
			} else if (55296 <= r && r < 57344) {
				_slice$5 = a, _index$5 = n, (_index$5 >= 0 && _index$5 < _slice$5.length) ? (_slice$5.array[_slice$5.offset + _index$5] = 65533) : go$throwRuntimeError("index out of range");
				n = n + 1 >> 0;
			} else {
				_slice$6 = a, _index$6 = n, (_index$6 >= 0 && _index$6 < _slice$6.length) ? (_slice$6.array[_slice$6.offset + _index$6] = (r >> 0)) : go$throwRuntimeError("index out of range");
				n = n + 1 >> 0;
			}
			i = i + 1 >> 0;
		}
		return go$subslice(a, 0, n);
	};
	go$pkg.init = function() {
	};
	return go$pkg;
})();
go$packages["syscall"] = (function() {
	var go$pkg = {};
	var sync = go$packages["sync"];
	var atomic = go$packages["sync/atomic"];
	var utf16 = go$packages["unicode/utf16"];
	var errors$1 = go$packages["errors"];
	var DLLError;
	DLLError = go$newType(0, "Struct", "syscall.DLLError", "DLLError", "syscall", function(Err_, ObjName_, Msg_) {
		this.go$val = this;
		this.Err = Err_ !== undefined ? Err_ : null;
		this.ObjName = ObjName_ !== undefined ? ObjName_ : "";
		this.Msg = Msg_ !== undefined ? Msg_ : "";
	});
	go$pkg.DLLError = DLLError;
	var DLL;
	DLL = go$newType(0, "Struct", "syscall.DLL", "DLL", "syscall", function(Name_, Handle_) {
		this.go$val = this;
		this.Name = Name_ !== undefined ? Name_ : "";
		this.Handle = Handle_ !== undefined ? Handle_ : 0;
	});
	go$pkg.DLL = DLL;
	var Proc;
	Proc = go$newType(0, "Struct", "syscall.Proc", "Proc", "syscall", function(Dll_, Name_, addr_) {
		this.go$val = this;
		this.Dll = Dll_ !== undefined ? Dll_ : (go$ptrType(DLL)).nil;
		this.Name = Name_ !== undefined ? Name_ : "";
		this.addr = addr_ !== undefined ? addr_ : 0;
	});
	go$pkg.Proc = Proc;
	var LazyDLL;
	LazyDLL = go$newType(0, "Struct", "syscall.LazyDLL", "LazyDLL", "syscall", function(mu_, dll_, Name_) {
		this.go$val = this;
		this.mu = mu_ !== undefined ? mu_ : new sync.Mutex.Ptr();
		this.dll = dll_ !== undefined ? dll_ : (go$ptrType(DLL)).nil;
		this.Name = Name_ !== undefined ? Name_ : "";
	});
	go$pkg.LazyDLL = LazyDLL;
	var LazyProc;
	LazyProc = go$newType(0, "Struct", "syscall.LazyProc", "LazyProc", "syscall", function(mu_, Name_, l_, proc_) {
		this.go$val = this;
		this.mu = mu_ !== undefined ? mu_ : new sync.Mutex.Ptr();
		this.Name = Name_ !== undefined ? Name_ : "";
		this.l = l_ !== undefined ? l_ : (go$ptrType(LazyDLL)).nil;
		this.proc = proc_ !== undefined ? proc_ : (go$ptrType(Proc)).nil;
	});
	go$pkg.LazyProc = LazyProc;
	var ProcAttr;
	ProcAttr = go$newType(0, "Struct", "syscall.ProcAttr", "ProcAttr", "syscall", function(Dir_, Env_, Files_, Sys_) {
		this.go$val = this;
		this.Dir = Dir_ !== undefined ? Dir_ : "";
		this.Env = Env_ !== undefined ? Env_ : (go$sliceType(Go$String)).nil;
		this.Files = Files_ !== undefined ? Files_ : (go$sliceType(Go$Uintptr)).nil;
		this.Sys = Sys_ !== undefined ? Sys_ : (go$ptrType(SysProcAttr)).nil;
	});
	go$pkg.ProcAttr = ProcAttr;
	var SysProcAttr;
	SysProcAttr = go$newType(0, "Struct", "syscall.SysProcAttr", "SysProcAttr", "syscall", function(HideWindow_, CmdLine_, CreationFlags_) {
		this.go$val = this;
		this.HideWindow = HideWindow_ !== undefined ? HideWindow_ : false;
		this.CmdLine = CmdLine_ !== undefined ? CmdLine_ : "";
		this.CreationFlags = CreationFlags_ !== undefined ? CreationFlags_ : 0;
	});
	go$pkg.SysProcAttr = SysProcAttr;
	var UserInfo10;
	UserInfo10 = go$newType(0, "Struct", "syscall.UserInfo10", "UserInfo10", "syscall", function(Name_, Comment_, UsrComment_, FullName_) {
		this.go$val = this;
		this.Name = Name_ !== undefined ? Name_ : (go$ptrType(Go$Uint16)).nil;
		this.Comment = Comment_ !== undefined ? Comment_ : (go$ptrType(Go$Uint16)).nil;
		this.UsrComment = UsrComment_ !== undefined ? UsrComment_ : (go$ptrType(Go$Uint16)).nil;
		this.FullName = FullName_ !== undefined ? FullName_ : (go$ptrType(Go$Uint16)).nil;
	});
	go$pkg.UserInfo10 = UserInfo10;
	var SID;
	SID = go$newType(0, "Struct", "syscall.SID", "SID", "syscall", function() {
		this.go$val = this;
	});
	go$pkg.SID = SID;
	var SIDAndAttributes;
	SIDAndAttributes = go$newType(0, "Struct", "syscall.SIDAndAttributes", "SIDAndAttributes", "syscall", function(Sid_, Attributes_) {
		this.go$val = this;
		this.Sid = Sid_ !== undefined ? Sid_ : (go$ptrType(SID)).nil;
		this.Attributes = Attributes_ !== undefined ? Attributes_ : 0;
	});
	go$pkg.SIDAndAttributes = SIDAndAttributes;
	var Tokenuser;
	Tokenuser = go$newType(0, "Struct", "syscall.Tokenuser", "Tokenuser", "syscall", function(User_) {
		this.go$val = this;
		this.User = User_ !== undefined ? User_ : new SIDAndAttributes.Ptr();
	});
	go$pkg.Tokenuser = Tokenuser;
	var Tokenprimarygroup;
	Tokenprimarygroup = go$newType(0, "Struct", "syscall.Tokenprimarygroup", "Tokenprimarygroup", "syscall", function(PrimaryGroup_) {
		this.go$val = this;
		this.PrimaryGroup = PrimaryGroup_ !== undefined ? PrimaryGroup_ : (go$ptrType(SID)).nil;
	});
	go$pkg.Tokenprimarygroup = Tokenprimarygroup;
	var Token;
	Token = go$newType(4, "Uintptr", "syscall.Token", "Token", "syscall", null);
	go$pkg.Token = Token;
	var Handle;
	Handle = go$newType(4, "Uintptr", "syscall.Handle", "Handle", "syscall", null);
	go$pkg.Handle = Handle;
	var Errno;
	Errno = go$newType(4, "Uintptr", "syscall.Errno", "Errno", "syscall", null);
	go$pkg.Errno = Errno;
	var RawSockaddrInet4;
	RawSockaddrInet4 = go$newType(0, "Struct", "syscall.RawSockaddrInet4", "RawSockaddrInet4", "syscall", function(Family_, Port_, Addr_, Zero_) {
		this.go$val = this;
		this.Family = Family_ !== undefined ? Family_ : 0;
		this.Port = Port_ !== undefined ? Port_ : 0;
		this.Addr = Addr_ !== undefined ? Addr_ : go$makeNativeArray("Uint8", 4, function() { return 0; });
		this.Zero = Zero_ !== undefined ? Zero_ : go$makeNativeArray("Uint8", 8, function() { return 0; });
	});
	go$pkg.RawSockaddrInet4 = RawSockaddrInet4;
	var RawSockaddrInet6;
	RawSockaddrInet6 = go$newType(0, "Struct", "syscall.RawSockaddrInet6", "RawSockaddrInet6", "syscall", function(Family_, Port_, Flowinfo_, Addr_, Scope_id_) {
		this.go$val = this;
		this.Family = Family_ !== undefined ? Family_ : 0;
		this.Port = Port_ !== undefined ? Port_ : 0;
		this.Flowinfo = Flowinfo_ !== undefined ? Flowinfo_ : 0;
		this.Addr = Addr_ !== undefined ? Addr_ : go$makeNativeArray("Uint8", 16, function() { return 0; });
		this.Scope_id = Scope_id_ !== undefined ? Scope_id_ : 0;
	});
	go$pkg.RawSockaddrInet6 = RawSockaddrInet6;
	var RawSockaddr;
	RawSockaddr = go$newType(0, "Struct", "syscall.RawSockaddr", "RawSockaddr", "syscall", function(Family_, Data_) {
		this.go$val = this;
		this.Family = Family_ !== undefined ? Family_ : 0;
		this.Data = Data_ !== undefined ? Data_ : go$makeNativeArray("Int8", 14, function() { return 0; });
	});
	go$pkg.RawSockaddr = RawSockaddr;
	var RawSockaddrAny;
	RawSockaddrAny = go$newType(0, "Struct", "syscall.RawSockaddrAny", "RawSockaddrAny", "syscall", function(Addr_, Pad_) {
		this.go$val = this;
		this.Addr = Addr_ !== undefined ? Addr_ : new RawSockaddr.Ptr();
		this.Pad = Pad_ !== undefined ? Pad_ : go$makeNativeArray("Int8", 96, function() { return 0; });
	});
	go$pkg.RawSockaddrAny = RawSockaddrAny;
	var Sockaddr;
	Sockaddr = go$newType(0, "Interface", "syscall.Sockaddr", "Sockaddr", "syscall", null);
	go$pkg.Sockaddr = Sockaddr;
	var SockaddrInet4;
	SockaddrInet4 = go$newType(0, "Struct", "syscall.SockaddrInet4", "SockaddrInet4", "syscall", function(Port_, Addr_, raw_) {
		this.go$val = this;
		this.Port = Port_ !== undefined ? Port_ : 0;
		this.Addr = Addr_ !== undefined ? Addr_ : go$makeNativeArray("Uint8", 4, function() { return 0; });
		this.raw = raw_ !== undefined ? raw_ : new RawSockaddrInet4.Ptr();
	});
	go$pkg.SockaddrInet4 = SockaddrInet4;
	var SockaddrInet6;
	SockaddrInet6 = go$newType(0, "Struct", "syscall.SockaddrInet6", "SockaddrInet6", "syscall", function(Port_, ZoneId_, Addr_, raw_) {
		this.go$val = this;
		this.Port = Port_ !== undefined ? Port_ : 0;
		this.ZoneId = ZoneId_ !== undefined ? ZoneId_ : 0;
		this.Addr = Addr_ !== undefined ? Addr_ : go$makeNativeArray("Uint8", 16, function() { return 0; });
		this.raw = raw_ !== undefined ? raw_ : new RawSockaddrInet6.Ptr();
	});
	go$pkg.SockaddrInet6 = SockaddrInet6;
	var SockaddrUnix;
	SockaddrUnix = go$newType(0, "Struct", "syscall.SockaddrUnix", "SockaddrUnix", "syscall", function(Name_) {
		this.go$val = this;
		this.Name = Name_ !== undefined ? Name_ : "";
	});
	go$pkg.SockaddrUnix = SockaddrUnix;
	var Rusage;
	Rusage = go$newType(0, "Struct", "syscall.Rusage", "Rusage", "syscall", function(CreationTime_, ExitTime_, KernelTime_, UserTime_) {
		this.go$val = this;
		this.CreationTime = CreationTime_ !== undefined ? CreationTime_ : new Filetime.Ptr();
		this.ExitTime = ExitTime_ !== undefined ? ExitTime_ : new Filetime.Ptr();
		this.KernelTime = KernelTime_ !== undefined ? KernelTime_ : new Filetime.Ptr();
		this.UserTime = UserTime_ !== undefined ? UserTime_ : new Filetime.Ptr();
	});
	go$pkg.Rusage = Rusage;
	var WaitStatus;
	WaitStatus = go$newType(0, "Struct", "syscall.WaitStatus", "WaitStatus", "syscall", function(ExitCode_) {
		this.go$val = this;
		this.ExitCode = ExitCode_ !== undefined ? ExitCode_ : 0;
	});
	go$pkg.WaitStatus = WaitStatus;
	var Timespec;
	Timespec = go$newType(0, "Struct", "syscall.Timespec", "Timespec", "syscall", function(Sec_, Nsec_) {
		this.go$val = this;
		this.Sec = Sec_ !== undefined ? Sec_ : new Go$Int64(0, 0);
		this.Nsec = Nsec_ !== undefined ? Nsec_ : new Go$Int64(0, 0);
	});
	go$pkg.Timespec = Timespec;
	var Linger;
	Linger = go$newType(0, "Struct", "syscall.Linger", "Linger", "syscall", function(Onoff_, Linger_) {
		this.go$val = this;
		this.Onoff = Onoff_ !== undefined ? Onoff_ : 0;
		this.Linger = Linger_ !== undefined ? Linger_ : 0;
	});
	go$pkg.Linger = Linger;
	var sysLinger;
	sysLinger = go$newType(0, "Struct", "syscall.sysLinger", "sysLinger", "syscall", function(Onoff_, Linger_) {
		this.go$val = this;
		this.Onoff = Onoff_ !== undefined ? Onoff_ : 0;
		this.Linger = Linger_ !== undefined ? Linger_ : 0;
	});
	go$pkg.sysLinger = sysLinger;
	var IPMreq;
	IPMreq = go$newType(0, "Struct", "syscall.IPMreq", "IPMreq", "syscall", function(Multiaddr_, Interface_) {
		this.go$val = this;
		this.Multiaddr = Multiaddr_ !== undefined ? Multiaddr_ : go$makeNativeArray("Uint8", 4, function() { return 0; });
		this.Interface = Interface_ !== undefined ? Interface_ : go$makeNativeArray("Uint8", 4, function() { return 0; });
	});
	go$pkg.IPMreq = IPMreq;
	var IPv6Mreq;
	IPv6Mreq = go$newType(0, "Struct", "syscall.IPv6Mreq", "IPv6Mreq", "syscall", function(Multiaddr_, Interface_) {
		this.go$val = this;
		this.Multiaddr = Multiaddr_ !== undefined ? Multiaddr_ : go$makeNativeArray("Uint8", 16, function() { return 0; });
		this.Interface = Interface_ !== undefined ? Interface_ : 0;
	});
	go$pkg.IPv6Mreq = IPv6Mreq;
	var Signal;
	Signal = go$newType(4, "Int", "syscall.Signal", "Signal", "syscall", null);
	go$pkg.Signal = Signal;
	var Timeval;
	Timeval = go$newType(0, "Struct", "syscall.Timeval", "Timeval", "syscall", function(Sec_, Usec_) {
		this.go$val = this;
		this.Sec = Sec_ !== undefined ? Sec_ : 0;
		this.Usec = Usec_ !== undefined ? Usec_ : 0;
	});
	go$pkg.Timeval = Timeval;
	var SecurityAttributes;
	SecurityAttributes = go$newType(0, "Struct", "syscall.SecurityAttributes", "SecurityAttributes", "syscall", function(Length_, SecurityDescriptor_, InheritHandle_) {
		this.go$val = this;
		this.Length = Length_ !== undefined ? Length_ : 0;
		this.SecurityDescriptor = SecurityDescriptor_ !== undefined ? SecurityDescriptor_ : 0;
		this.InheritHandle = InheritHandle_ !== undefined ? InheritHandle_ : 0;
	});
	go$pkg.SecurityAttributes = SecurityAttributes;
	var Overlapped;
	Overlapped = go$newType(0, "Struct", "syscall.Overlapped", "Overlapped", "syscall", function(Internal_, InternalHigh_, Offset_, OffsetHigh_, HEvent_) {
		this.go$val = this;
		this.Internal = Internal_ !== undefined ? Internal_ : 0;
		this.InternalHigh = InternalHigh_ !== undefined ? InternalHigh_ : 0;
		this.Offset = Offset_ !== undefined ? Offset_ : 0;
		this.OffsetHigh = OffsetHigh_ !== undefined ? OffsetHigh_ : 0;
		this.HEvent = HEvent_ !== undefined ? HEvent_ : 0;
	});
	go$pkg.Overlapped = Overlapped;
	var FileNotifyInformation;
	FileNotifyInformation = go$newType(0, "Struct", "syscall.FileNotifyInformation", "FileNotifyInformation", "syscall", function(NextEntryOffset_, Action_, FileNameLength_, FileName_) {
		this.go$val = this;
		this.NextEntryOffset = NextEntryOffset_ !== undefined ? NextEntryOffset_ : 0;
		this.Action = Action_ !== undefined ? Action_ : 0;
		this.FileNameLength = FileNameLength_ !== undefined ? FileNameLength_ : 0;
		this.FileName = FileName_ !== undefined ? FileName_ : 0;
	});
	go$pkg.FileNotifyInformation = FileNotifyInformation;
	var Filetime;
	Filetime = go$newType(0, "Struct", "syscall.Filetime", "Filetime", "syscall", function(LowDateTime_, HighDateTime_) {
		this.go$val = this;
		this.LowDateTime = LowDateTime_ !== undefined ? LowDateTime_ : 0;
		this.HighDateTime = HighDateTime_ !== undefined ? HighDateTime_ : 0;
	});
	go$pkg.Filetime = Filetime;
	var Win32finddata;
	Win32finddata = go$newType(0, "Struct", "syscall.Win32finddata", "Win32finddata", "syscall", function(FileAttributes_, CreationTime_, LastAccessTime_, LastWriteTime_, FileSizeHigh_, FileSizeLow_, Reserved0_, Reserved1_, FileName_, AlternateFileName_) {
		this.go$val = this;
		this.FileAttributes = FileAttributes_ !== undefined ? FileAttributes_ : 0;
		this.CreationTime = CreationTime_ !== undefined ? CreationTime_ : new Filetime.Ptr();
		this.LastAccessTime = LastAccessTime_ !== undefined ? LastAccessTime_ : new Filetime.Ptr();
		this.LastWriteTime = LastWriteTime_ !== undefined ? LastWriteTime_ : new Filetime.Ptr();
		this.FileSizeHigh = FileSizeHigh_ !== undefined ? FileSizeHigh_ : 0;
		this.FileSizeLow = FileSizeLow_ !== undefined ? FileSizeLow_ : 0;
		this.Reserved0 = Reserved0_ !== undefined ? Reserved0_ : 0;
		this.Reserved1 = Reserved1_ !== undefined ? Reserved1_ : 0;
		this.FileName = FileName_ !== undefined ? FileName_ : go$makeNativeArray("Uint16", 259, function() { return 0; });
		this.AlternateFileName = AlternateFileName_ !== undefined ? AlternateFileName_ : go$makeNativeArray("Uint16", 13, function() { return 0; });
	});
	go$pkg.Win32finddata = Win32finddata;
	var win32finddata1;
	win32finddata1 = go$newType(0, "Struct", "syscall.win32finddata1", "win32finddata1", "syscall", function(FileAttributes_, CreationTime_, LastAccessTime_, LastWriteTime_, FileSizeHigh_, FileSizeLow_, Reserved0_, Reserved1_, FileName_, AlternateFileName_) {
		this.go$val = this;
		this.FileAttributes = FileAttributes_ !== undefined ? FileAttributes_ : 0;
		this.CreationTime = CreationTime_ !== undefined ? CreationTime_ : new Filetime.Ptr();
		this.LastAccessTime = LastAccessTime_ !== undefined ? LastAccessTime_ : new Filetime.Ptr();
		this.LastWriteTime = LastWriteTime_ !== undefined ? LastWriteTime_ : new Filetime.Ptr();
		this.FileSizeHigh = FileSizeHigh_ !== undefined ? FileSizeHigh_ : 0;
		this.FileSizeLow = FileSizeLow_ !== undefined ? FileSizeLow_ : 0;
		this.Reserved0 = Reserved0_ !== undefined ? Reserved0_ : 0;
		this.Reserved1 = Reserved1_ !== undefined ? Reserved1_ : 0;
		this.FileName = FileName_ !== undefined ? FileName_ : go$makeNativeArray("Uint16", 260, function() { return 0; });
		this.AlternateFileName = AlternateFileName_ !== undefined ? AlternateFileName_ : go$makeNativeArray("Uint16", 14, function() { return 0; });
	});
	go$pkg.win32finddata1 = win32finddata1;
	var ByHandleFileInformation;
	ByHandleFileInformation = go$newType(0, "Struct", "syscall.ByHandleFileInformation", "ByHandleFileInformation", "syscall", function(FileAttributes_, CreationTime_, LastAccessTime_, LastWriteTime_, VolumeSerialNumber_, FileSizeHigh_, FileSizeLow_, NumberOfLinks_, FileIndexHigh_, FileIndexLow_) {
		this.go$val = this;
		this.FileAttributes = FileAttributes_ !== undefined ? FileAttributes_ : 0;
		this.CreationTime = CreationTime_ !== undefined ? CreationTime_ : new Filetime.Ptr();
		this.LastAccessTime = LastAccessTime_ !== undefined ? LastAccessTime_ : new Filetime.Ptr();
		this.LastWriteTime = LastWriteTime_ !== undefined ? LastWriteTime_ : new Filetime.Ptr();
		this.VolumeSerialNumber = VolumeSerialNumber_ !== undefined ? VolumeSerialNumber_ : 0;
		this.FileSizeHigh = FileSizeHigh_ !== undefined ? FileSizeHigh_ : 0;
		this.FileSizeLow = FileSizeLow_ !== undefined ? FileSizeLow_ : 0;
		this.NumberOfLinks = NumberOfLinks_ !== undefined ? NumberOfLinks_ : 0;
		this.FileIndexHigh = FileIndexHigh_ !== undefined ? FileIndexHigh_ : 0;
		this.FileIndexLow = FileIndexLow_ !== undefined ? FileIndexLow_ : 0;
	});
	go$pkg.ByHandleFileInformation = ByHandleFileInformation;
	var Win32FileAttributeData;
	Win32FileAttributeData = go$newType(0, "Struct", "syscall.Win32FileAttributeData", "Win32FileAttributeData", "syscall", function(FileAttributes_, CreationTime_, LastAccessTime_, LastWriteTime_, FileSizeHigh_, FileSizeLow_) {
		this.go$val = this;
		this.FileAttributes = FileAttributes_ !== undefined ? FileAttributes_ : 0;
		this.CreationTime = CreationTime_ !== undefined ? CreationTime_ : new Filetime.Ptr();
		this.LastAccessTime = LastAccessTime_ !== undefined ? LastAccessTime_ : new Filetime.Ptr();
		this.LastWriteTime = LastWriteTime_ !== undefined ? LastWriteTime_ : new Filetime.Ptr();
		this.FileSizeHigh = FileSizeHigh_ !== undefined ? FileSizeHigh_ : 0;
		this.FileSizeLow = FileSizeLow_ !== undefined ? FileSizeLow_ : 0;
	});
	go$pkg.Win32FileAttributeData = Win32FileAttributeData;
	var StartupInfo;
	StartupInfo = go$newType(0, "Struct", "syscall.StartupInfo", "StartupInfo", "syscall", function(Cb_, _$1_, Desktop_, Title_, X_, Y_, XSize_, YSize_, XCountChars_, YCountChars_, FillAttribute_, Flags_, ShowWindow_, _$13_, _$14_, StdInput_, StdOutput_, StdErr_) {
		this.go$val = this;
		this.Cb = Cb_ !== undefined ? Cb_ : 0;
		this._$1 = _$1_ !== undefined ? _$1_ : (go$ptrType(Go$Uint16)).nil;
		this.Desktop = Desktop_ !== undefined ? Desktop_ : (go$ptrType(Go$Uint16)).nil;
		this.Title = Title_ !== undefined ? Title_ : (go$ptrType(Go$Uint16)).nil;
		this.X = X_ !== undefined ? X_ : 0;
		this.Y = Y_ !== undefined ? Y_ : 0;
		this.XSize = XSize_ !== undefined ? XSize_ : 0;
		this.YSize = YSize_ !== undefined ? YSize_ : 0;
		this.XCountChars = XCountChars_ !== undefined ? XCountChars_ : 0;
		this.YCountChars = YCountChars_ !== undefined ? YCountChars_ : 0;
		this.FillAttribute = FillAttribute_ !== undefined ? FillAttribute_ : 0;
		this.Flags = Flags_ !== undefined ? Flags_ : 0;
		this.ShowWindow = ShowWindow_ !== undefined ? ShowWindow_ : 0;
		this._$13 = _$13_ !== undefined ? _$13_ : 0;
		this._$14 = _$14_ !== undefined ? _$14_ : (go$ptrType(Go$Uint8)).nil;
		this.StdInput = StdInput_ !== undefined ? StdInput_ : 0;
		this.StdOutput = StdOutput_ !== undefined ? StdOutput_ : 0;
		this.StdErr = StdErr_ !== undefined ? StdErr_ : 0;
	});
	go$pkg.StartupInfo = StartupInfo;
	var ProcessInformation;
	ProcessInformation = go$newType(0, "Struct", "syscall.ProcessInformation", "ProcessInformation", "syscall", function(Process_, Thread_, ProcessId_, ThreadId_) {
		this.go$val = this;
		this.Process = Process_ !== undefined ? Process_ : 0;
		this.Thread = Thread_ !== undefined ? Thread_ : 0;
		this.ProcessId = ProcessId_ !== undefined ? ProcessId_ : 0;
		this.ThreadId = ThreadId_ !== undefined ? ThreadId_ : 0;
	});
	go$pkg.ProcessInformation = ProcessInformation;
	var Systemtime;
	Systemtime = go$newType(0, "Struct", "syscall.Systemtime", "Systemtime", "syscall", function(Year_, Month_, DayOfWeek_, Day_, Hour_, Minute_, Second_, Milliseconds_) {
		this.go$val = this;
		this.Year = Year_ !== undefined ? Year_ : 0;
		this.Month = Month_ !== undefined ? Month_ : 0;
		this.DayOfWeek = DayOfWeek_ !== undefined ? DayOfWeek_ : 0;
		this.Day = Day_ !== undefined ? Day_ : 0;
		this.Hour = Hour_ !== undefined ? Hour_ : 0;
		this.Minute = Minute_ !== undefined ? Minute_ : 0;
		this.Second = Second_ !== undefined ? Second_ : 0;
		this.Milliseconds = Milliseconds_ !== undefined ? Milliseconds_ : 0;
	});
	go$pkg.Systemtime = Systemtime;
	var Timezoneinformation;
	Timezoneinformation = go$newType(0, "Struct", "syscall.Timezoneinformation", "Timezoneinformation", "syscall", function(Bias_, StandardName_, StandardDate_, StandardBias_, DaylightName_, DaylightDate_, DaylightBias_) {
		this.go$val = this;
		this.Bias = Bias_ !== undefined ? Bias_ : 0;
		this.StandardName = StandardName_ !== undefined ? StandardName_ : go$makeNativeArray("Uint16", 32, function() { return 0; });
		this.StandardDate = StandardDate_ !== undefined ? StandardDate_ : new Systemtime.Ptr();
		this.StandardBias = StandardBias_ !== undefined ? StandardBias_ : 0;
		this.DaylightName = DaylightName_ !== undefined ? DaylightName_ : go$makeNativeArray("Uint16", 32, function() { return 0; });
		this.DaylightDate = DaylightDate_ !== undefined ? DaylightDate_ : new Systemtime.Ptr();
		this.DaylightBias = DaylightBias_ !== undefined ? DaylightBias_ : 0;
	});
	go$pkg.Timezoneinformation = Timezoneinformation;
	var WSABuf;
	WSABuf = go$newType(0, "Struct", "syscall.WSABuf", "WSABuf", "syscall", function(Len_, Buf_) {
		this.go$val = this;
		this.Len = Len_ !== undefined ? Len_ : 0;
		this.Buf = Buf_ !== undefined ? Buf_ : (go$ptrType(Go$Uint8)).nil;
	});
	go$pkg.WSABuf = WSABuf;
	var Hostent;
	Hostent = go$newType(0, "Struct", "syscall.Hostent", "Hostent", "syscall", function(Name_, Aliases_, AddrType_, Length_, AddrList_) {
		this.go$val = this;
		this.Name = Name_ !== undefined ? Name_ : (go$ptrType(Go$Uint8)).nil;
		this.Aliases = Aliases_ !== undefined ? Aliases_ : (go$ptrType((go$ptrType(Go$Uint8)))).nil;
		this.AddrType = AddrType_ !== undefined ? AddrType_ : 0;
		this.Length = Length_ !== undefined ? Length_ : 0;
		this.AddrList = AddrList_ !== undefined ? AddrList_ : (go$ptrType((go$ptrType(Go$Uint8)))).nil;
	});
	go$pkg.Hostent = Hostent;
	var Protoent;
	Protoent = go$newType(0, "Struct", "syscall.Protoent", "Protoent", "syscall", function(Name_, Aliases_, Proto_) {
		this.go$val = this;
		this.Name = Name_ !== undefined ? Name_ : (go$ptrType(Go$Uint8)).nil;
		this.Aliases = Aliases_ !== undefined ? Aliases_ : (go$ptrType((go$ptrType(Go$Uint8)))).nil;
		this.Proto = Proto_ !== undefined ? Proto_ : 0;
	});
	go$pkg.Protoent = Protoent;
	var DNSSRVData;
	DNSSRVData = go$newType(0, "Struct", "syscall.DNSSRVData", "DNSSRVData", "syscall", function(Target_, Priority_, Weight_, Port_, Pad_) {
		this.go$val = this;
		this.Target = Target_ !== undefined ? Target_ : (go$ptrType(Go$Uint16)).nil;
		this.Priority = Priority_ !== undefined ? Priority_ : 0;
		this.Weight = Weight_ !== undefined ? Weight_ : 0;
		this.Port = Port_ !== undefined ? Port_ : 0;
		this.Pad = Pad_ !== undefined ? Pad_ : 0;
	});
	go$pkg.DNSSRVData = DNSSRVData;
	var DNSPTRData;
	DNSPTRData = go$newType(0, "Struct", "syscall.DNSPTRData", "DNSPTRData", "syscall", function(Host_) {
		this.go$val = this;
		this.Host = Host_ !== undefined ? Host_ : (go$ptrType(Go$Uint16)).nil;
	});
	go$pkg.DNSPTRData = DNSPTRData;
	var DNSMXData;
	DNSMXData = go$newType(0, "Struct", "syscall.DNSMXData", "DNSMXData", "syscall", function(NameExchange_, Preference_, Pad_) {
		this.go$val = this;
		this.NameExchange = NameExchange_ !== undefined ? NameExchange_ : (go$ptrType(Go$Uint16)).nil;
		this.Preference = Preference_ !== undefined ? Preference_ : 0;
		this.Pad = Pad_ !== undefined ? Pad_ : 0;
	});
	go$pkg.DNSMXData = DNSMXData;
	var DNSTXTData;
	DNSTXTData = go$newType(0, "Struct", "syscall.DNSTXTData", "DNSTXTData", "syscall", function(StringCount_, StringArray_) {
		this.go$val = this;
		this.StringCount = StringCount_ !== undefined ? StringCount_ : 0;
		this.StringArray = StringArray_ !== undefined ? StringArray_ : go$makeNativeArray("Ptr", 1, function() { return (go$ptrType(Go$Uint16)).nil; });
	});
	go$pkg.DNSTXTData = DNSTXTData;
	var DNSRecord;
	DNSRecord = go$newType(0, "Struct", "syscall.DNSRecord", "DNSRecord", "syscall", function(Next_, Name_, Type_, Length_, Dw_, Ttl_, Reserved_, Data_) {
		this.go$val = this;
		this.Next = Next_ !== undefined ? Next_ : (go$ptrType(DNSRecord)).nil;
		this.Name = Name_ !== undefined ? Name_ : (go$ptrType(Go$Uint16)).nil;
		this.Type = Type_ !== undefined ? Type_ : 0;
		this.Length = Length_ !== undefined ? Length_ : 0;
		this.Dw = Dw_ !== undefined ? Dw_ : 0;
		this.Ttl = Ttl_ !== undefined ? Ttl_ : 0;
		this.Reserved = Reserved_ !== undefined ? Reserved_ : 0;
		this.Data = Data_ !== undefined ? Data_ : go$makeNativeArray("Uint8", 40, function() { return 0; });
	});
	go$pkg.DNSRecord = DNSRecord;
	var TransmitFileBuffers;
	TransmitFileBuffers = go$newType(0, "Struct", "syscall.TransmitFileBuffers", "TransmitFileBuffers", "syscall", function(Head_, HeadLength_, Tail_, TailLength_) {
		this.go$val = this;
		this.Head = Head_ !== undefined ? Head_ : 0;
		this.HeadLength = HeadLength_ !== undefined ? HeadLength_ : 0;
		this.Tail = Tail_ !== undefined ? Tail_ : 0;
		this.TailLength = TailLength_ !== undefined ? TailLength_ : 0;
	});
	go$pkg.TransmitFileBuffers = TransmitFileBuffers;
	var SockaddrGen;
	SockaddrGen = go$newType(0, "Array", "syscall.SockaddrGen", "SockaddrGen", "syscall", null);
	go$pkg.SockaddrGen = SockaddrGen;
	var InterfaceInfo;
	InterfaceInfo = go$newType(0, "Struct", "syscall.InterfaceInfo", "InterfaceInfo", "syscall", function(Flags_, Address_, BroadcastAddress_, Netmask_) {
		this.go$val = this;
		this.Flags = Flags_ !== undefined ? Flags_ : 0;
		this.Address = Address_ !== undefined ? Address_ : go$makeNativeArray("Uint8", 24, function() { return 0; });
		this.BroadcastAddress = BroadcastAddress_ !== undefined ? BroadcastAddress_ : go$makeNativeArray("Uint8", 24, function() { return 0; });
		this.Netmask = Netmask_ !== undefined ? Netmask_ : go$makeNativeArray("Uint8", 24, function() { return 0; });
	});
	go$pkg.InterfaceInfo = InterfaceInfo;
	var IpAddressString;
	IpAddressString = go$newType(0, "Struct", "syscall.IpAddressString", "IpAddressString", "syscall", function(String_) {
		this.go$val = this;
		this.String = String_ !== undefined ? String_ : go$makeNativeArray("Uint8", 16, function() { return 0; });
	});
	go$pkg.IpAddressString = IpAddressString;
	var IpMaskString;
	IpMaskString = go$newType(0, "Struct", "syscall.IpMaskString", "IpMaskString", "syscall", function(String_) {
		this.go$val = this;
		this.String = String_ !== undefined ? String_ : go$makeNativeArray("Uint8", 16, function() { return 0; });
	});
	go$pkg.IpMaskString = IpMaskString;
	var IpAddrString;
	IpAddrString = go$newType(0, "Struct", "syscall.IpAddrString", "IpAddrString", "syscall", function(Next_, IpAddress_, IpMask_, Context_) {
		this.go$val = this;
		this.Next = Next_ !== undefined ? Next_ : (go$ptrType(IpAddrString)).nil;
		this.IpAddress = IpAddress_ !== undefined ? IpAddress_ : new IpAddressString.Ptr();
		this.IpMask = IpMask_ !== undefined ? IpMask_ : new IpMaskString.Ptr();
		this.Context = Context_ !== undefined ? Context_ : 0;
	});
	go$pkg.IpAddrString = IpAddrString;
	var IpAdapterInfo;
	IpAdapterInfo = go$newType(0, "Struct", "syscall.IpAdapterInfo", "IpAdapterInfo", "syscall", function(Next_, ComboIndex_, AdapterName_, Description_, AddressLength_, Address_, Index_, Type_, DhcpEnabled_, CurrentIpAddress_, IpAddressList_, GatewayList_, DhcpServer_, HaveWins_, PrimaryWinsServer_, SecondaryWinsServer_, LeaseObtained_, LeaseExpires_) {
		this.go$val = this;
		this.Next = Next_ !== undefined ? Next_ : (go$ptrType(IpAdapterInfo)).nil;
		this.ComboIndex = ComboIndex_ !== undefined ? ComboIndex_ : 0;
		this.AdapterName = AdapterName_ !== undefined ? AdapterName_ : go$makeNativeArray("Uint8", 260, function() { return 0; });
		this.Description = Description_ !== undefined ? Description_ : go$makeNativeArray("Uint8", 132, function() { return 0; });
		this.AddressLength = AddressLength_ !== undefined ? AddressLength_ : 0;
		this.Address = Address_ !== undefined ? Address_ : go$makeNativeArray("Uint8", 8, function() { return 0; });
		this.Index = Index_ !== undefined ? Index_ : 0;
		this.Type = Type_ !== undefined ? Type_ : 0;
		this.DhcpEnabled = DhcpEnabled_ !== undefined ? DhcpEnabled_ : 0;
		this.CurrentIpAddress = CurrentIpAddress_ !== undefined ? CurrentIpAddress_ : (go$ptrType(IpAddrString)).nil;
		this.IpAddressList = IpAddressList_ !== undefined ? IpAddressList_ : new IpAddrString.Ptr();
		this.GatewayList = GatewayList_ !== undefined ? GatewayList_ : new IpAddrString.Ptr();
		this.DhcpServer = DhcpServer_ !== undefined ? DhcpServer_ : new IpAddrString.Ptr();
		this.HaveWins = HaveWins_ !== undefined ? HaveWins_ : false;
		this.PrimaryWinsServer = PrimaryWinsServer_ !== undefined ? PrimaryWinsServer_ : new IpAddrString.Ptr();
		this.SecondaryWinsServer = SecondaryWinsServer_ !== undefined ? SecondaryWinsServer_ : new IpAddrString.Ptr();
		this.LeaseObtained = LeaseObtained_ !== undefined ? LeaseObtained_ : new Go$Int64(0, 0);
		this.LeaseExpires = LeaseExpires_ !== undefined ? LeaseExpires_ : new Go$Int64(0, 0);
	});
	go$pkg.IpAdapterInfo = IpAdapterInfo;
	var MibIfRow;
	MibIfRow = go$newType(0, "Struct", "syscall.MibIfRow", "MibIfRow", "syscall", function(Name_, Index_, Type_, Mtu_, Speed_, PhysAddrLen_, PhysAddr_, AdminStatus_, OperStatus_, LastChange_, InOctets_, InUcastPkts_, InNUcastPkts_, InDiscards_, InErrors_, InUnknownProtos_, OutOctets_, OutUcastPkts_, OutNUcastPkts_, OutDiscards_, OutErrors_, OutQLen_, DescrLen_, Descr_) {
		this.go$val = this;
		this.Name = Name_ !== undefined ? Name_ : go$makeNativeArray("Uint16", 256, function() { return 0; });
		this.Index = Index_ !== undefined ? Index_ : 0;
		this.Type = Type_ !== undefined ? Type_ : 0;
		this.Mtu = Mtu_ !== undefined ? Mtu_ : 0;
		this.Speed = Speed_ !== undefined ? Speed_ : 0;
		this.PhysAddrLen = PhysAddrLen_ !== undefined ? PhysAddrLen_ : 0;
		this.PhysAddr = PhysAddr_ !== undefined ? PhysAddr_ : go$makeNativeArray("Uint8", 8, function() { return 0; });
		this.AdminStatus = AdminStatus_ !== undefined ? AdminStatus_ : 0;
		this.OperStatus = OperStatus_ !== undefined ? OperStatus_ : 0;
		this.LastChange = LastChange_ !== undefined ? LastChange_ : 0;
		this.InOctets = InOctets_ !== undefined ? InOctets_ : 0;
		this.InUcastPkts = InUcastPkts_ !== undefined ? InUcastPkts_ : 0;
		this.InNUcastPkts = InNUcastPkts_ !== undefined ? InNUcastPkts_ : 0;
		this.InDiscards = InDiscards_ !== undefined ? InDiscards_ : 0;
		this.InErrors = InErrors_ !== undefined ? InErrors_ : 0;
		this.InUnknownProtos = InUnknownProtos_ !== undefined ? InUnknownProtos_ : 0;
		this.OutOctets = OutOctets_ !== undefined ? OutOctets_ : 0;
		this.OutUcastPkts = OutUcastPkts_ !== undefined ? OutUcastPkts_ : 0;
		this.OutNUcastPkts = OutNUcastPkts_ !== undefined ? OutNUcastPkts_ : 0;
		this.OutDiscards = OutDiscards_ !== undefined ? OutDiscards_ : 0;
		this.OutErrors = OutErrors_ !== undefined ? OutErrors_ : 0;
		this.OutQLen = OutQLen_ !== undefined ? OutQLen_ : 0;
		this.DescrLen = DescrLen_ !== undefined ? DescrLen_ : 0;
		this.Descr = Descr_ !== undefined ? Descr_ : go$makeNativeArray("Uint8", 256, function() { return 0; });
	});
	go$pkg.MibIfRow = MibIfRow;
	var CertContext;
	CertContext = go$newType(0, "Struct", "syscall.CertContext", "CertContext", "syscall", function(EncodingType_, EncodedCert_, Length_, CertInfo_, Store_) {
		this.go$val = this;
		this.EncodingType = EncodingType_ !== undefined ? EncodingType_ : 0;
		this.EncodedCert = EncodedCert_ !== undefined ? EncodedCert_ : (go$ptrType(Go$Uint8)).nil;
		this.Length = Length_ !== undefined ? Length_ : 0;
		this.CertInfo = CertInfo_ !== undefined ? CertInfo_ : 0;
		this.Store = Store_ !== undefined ? Store_ : 0;
	});
	go$pkg.CertContext = CertContext;
	var CertChainContext;
	CertChainContext = go$newType(0, "Struct", "syscall.CertChainContext", "CertChainContext", "syscall", function(Size_, TrustStatus_, ChainCount_, Chains_, LowerQualityChainCount_, LowerQualityChains_, HasRevocationFreshnessTime_, RevocationFreshnessTime_) {
		this.go$val = this;
		this.Size = Size_ !== undefined ? Size_ : 0;
		this.TrustStatus = TrustStatus_ !== undefined ? TrustStatus_ : new CertTrustStatus.Ptr();
		this.ChainCount = ChainCount_ !== undefined ? ChainCount_ : 0;
		this.Chains = Chains_ !== undefined ? Chains_ : (go$ptrType((go$ptrType(CertSimpleChain)))).nil;
		this.LowerQualityChainCount = LowerQualityChainCount_ !== undefined ? LowerQualityChainCount_ : 0;
		this.LowerQualityChains = LowerQualityChains_ !== undefined ? LowerQualityChains_ : (go$ptrType((go$ptrType(CertChainContext)))).nil;
		this.HasRevocationFreshnessTime = HasRevocationFreshnessTime_ !== undefined ? HasRevocationFreshnessTime_ : 0;
		this.RevocationFreshnessTime = RevocationFreshnessTime_ !== undefined ? RevocationFreshnessTime_ : 0;
	});
	go$pkg.CertChainContext = CertChainContext;
	var CertSimpleChain;
	CertSimpleChain = go$newType(0, "Struct", "syscall.CertSimpleChain", "CertSimpleChain", "syscall", function(Size_, TrustStatus_, NumElements_, Elements_, TrustListInfo_, HasRevocationFreshnessTime_, RevocationFreshnessTime_) {
		this.go$val = this;
		this.Size = Size_ !== undefined ? Size_ : 0;
		this.TrustStatus = TrustStatus_ !== undefined ? TrustStatus_ : new CertTrustStatus.Ptr();
		this.NumElements = NumElements_ !== undefined ? NumElements_ : 0;
		this.Elements = Elements_ !== undefined ? Elements_ : (go$ptrType((go$ptrType(CertChainElement)))).nil;
		this.TrustListInfo = TrustListInfo_ !== undefined ? TrustListInfo_ : 0;
		this.HasRevocationFreshnessTime = HasRevocationFreshnessTime_ !== undefined ? HasRevocationFreshnessTime_ : 0;
		this.RevocationFreshnessTime = RevocationFreshnessTime_ !== undefined ? RevocationFreshnessTime_ : 0;
	});
	go$pkg.CertSimpleChain = CertSimpleChain;
	var CertChainElement;
	CertChainElement = go$newType(0, "Struct", "syscall.CertChainElement", "CertChainElement", "syscall", function(Size_, CertContext_, TrustStatus_, RevocationInfo_, IssuanceUsage_, ApplicationUsage_, ExtendedErrorInfo_) {
		this.go$val = this;
		this.Size = Size_ !== undefined ? Size_ : 0;
		this.CertContext = CertContext_ !== undefined ? CertContext_ : (go$ptrType(CertContext)).nil;
		this.TrustStatus = TrustStatus_ !== undefined ? TrustStatus_ : new CertTrustStatus.Ptr();
		this.RevocationInfo = RevocationInfo_ !== undefined ? RevocationInfo_ : (go$ptrType(CertRevocationInfo)).nil;
		this.IssuanceUsage = IssuanceUsage_ !== undefined ? IssuanceUsage_ : (go$ptrType(CertEnhKeyUsage)).nil;
		this.ApplicationUsage = ApplicationUsage_ !== undefined ? ApplicationUsage_ : (go$ptrType(CertEnhKeyUsage)).nil;
		this.ExtendedErrorInfo = ExtendedErrorInfo_ !== undefined ? ExtendedErrorInfo_ : (go$ptrType(Go$Uint16)).nil;
	});
	go$pkg.CertChainElement = CertChainElement;
	var CertRevocationInfo;
	CertRevocationInfo = go$newType(0, "Struct", "syscall.CertRevocationInfo", "CertRevocationInfo", "syscall", function(Size_, RevocationResult_, RevocationOid_, OidSpecificInfo_, HasFreshnessTime_, FreshnessTime_, CrlInfo_) {
		this.go$val = this;
		this.Size = Size_ !== undefined ? Size_ : 0;
		this.RevocationResult = RevocationResult_ !== undefined ? RevocationResult_ : 0;
		this.RevocationOid = RevocationOid_ !== undefined ? RevocationOid_ : (go$ptrType(Go$Uint8)).nil;
		this.OidSpecificInfo = OidSpecificInfo_ !== undefined ? OidSpecificInfo_ : 0;
		this.HasFreshnessTime = HasFreshnessTime_ !== undefined ? HasFreshnessTime_ : 0;
		this.FreshnessTime = FreshnessTime_ !== undefined ? FreshnessTime_ : 0;
		this.CrlInfo = CrlInfo_ !== undefined ? CrlInfo_ : 0;
	});
	go$pkg.CertRevocationInfo = CertRevocationInfo;
	var CertTrustStatus;
	CertTrustStatus = go$newType(0, "Struct", "syscall.CertTrustStatus", "CertTrustStatus", "syscall", function(ErrorStatus_, InfoStatus_) {
		this.go$val = this;
		this.ErrorStatus = ErrorStatus_ !== undefined ? ErrorStatus_ : 0;
		this.InfoStatus = InfoStatus_ !== undefined ? InfoStatus_ : 0;
	});
	go$pkg.CertTrustStatus = CertTrustStatus;
	var CertUsageMatch;
	CertUsageMatch = go$newType(0, "Struct", "syscall.CertUsageMatch", "CertUsageMatch", "syscall", function(Type_, Usage_) {
		this.go$val = this;
		this.Type = Type_ !== undefined ? Type_ : 0;
		this.Usage = Usage_ !== undefined ? Usage_ : new CertEnhKeyUsage.Ptr();
	});
	go$pkg.CertUsageMatch = CertUsageMatch;
	var CertEnhKeyUsage;
	CertEnhKeyUsage = go$newType(0, "Struct", "syscall.CertEnhKeyUsage", "CertEnhKeyUsage", "syscall", function(Length_, UsageIdentifiers_) {
		this.go$val = this;
		this.Length = Length_ !== undefined ? Length_ : 0;
		this.UsageIdentifiers = UsageIdentifiers_ !== undefined ? UsageIdentifiers_ : (go$ptrType((go$ptrType(Go$Uint8)))).nil;
	});
	go$pkg.CertEnhKeyUsage = CertEnhKeyUsage;
	var CertChainPara;
	CertChainPara = go$newType(0, "Struct", "syscall.CertChainPara", "CertChainPara", "syscall", function(Size_, RequestedUsage_, RequstedIssuancePolicy_, URLRetrievalTimeout_, CheckRevocationFreshnessTime_, RevocationFreshnessTime_, CacheResync_) {
		this.go$val = this;
		this.Size = Size_ !== undefined ? Size_ : 0;
		this.RequestedUsage = RequestedUsage_ !== undefined ? RequestedUsage_ : new CertUsageMatch.Ptr();
		this.RequstedIssuancePolicy = RequstedIssuancePolicy_ !== undefined ? RequstedIssuancePolicy_ : new CertUsageMatch.Ptr();
		this.URLRetrievalTimeout = URLRetrievalTimeout_ !== undefined ? URLRetrievalTimeout_ : 0;
		this.CheckRevocationFreshnessTime = CheckRevocationFreshnessTime_ !== undefined ? CheckRevocationFreshnessTime_ : 0;
		this.RevocationFreshnessTime = RevocationFreshnessTime_ !== undefined ? RevocationFreshnessTime_ : 0;
		this.CacheResync = CacheResync_ !== undefined ? CacheResync_ : (go$ptrType(Filetime)).nil;
	});
	go$pkg.CertChainPara = CertChainPara;
	var CertChainPolicyPara;
	CertChainPolicyPara = go$newType(0, "Struct", "syscall.CertChainPolicyPara", "CertChainPolicyPara", "syscall", function(Size_, Flags_, ExtraPolicyPara_) {
		this.go$val = this;
		this.Size = Size_ !== undefined ? Size_ : 0;
		this.Flags = Flags_ !== undefined ? Flags_ : 0;
		this.ExtraPolicyPara = ExtraPolicyPara_ !== undefined ? ExtraPolicyPara_ : 0;
	});
	go$pkg.CertChainPolicyPara = CertChainPolicyPara;
	var SSLExtraCertChainPolicyPara;
	SSLExtraCertChainPolicyPara = go$newType(0, "Struct", "syscall.SSLExtraCertChainPolicyPara", "SSLExtraCertChainPolicyPara", "syscall", function(Size_, AuthType_, Checks_, ServerName_) {
		this.go$val = this;
		this.Size = Size_ !== undefined ? Size_ : 0;
		this.AuthType = AuthType_ !== undefined ? AuthType_ : 0;
		this.Checks = Checks_ !== undefined ? Checks_ : 0;
		this.ServerName = ServerName_ !== undefined ? ServerName_ : (go$ptrType(Go$Uint16)).nil;
	});
	go$pkg.SSLExtraCertChainPolicyPara = SSLExtraCertChainPolicyPara;
	var CertChainPolicyStatus;
	CertChainPolicyStatus = go$newType(0, "Struct", "syscall.CertChainPolicyStatus", "CertChainPolicyStatus", "syscall", function(Size_, Error_, ChainIndex_, ElementIndex_, ExtraPolicyStatus_) {
		this.go$val = this;
		this.Size = Size_ !== undefined ? Size_ : 0;
		this.Error = Error_ !== undefined ? Error_ : 0;
		this.ChainIndex = ChainIndex_ !== undefined ? ChainIndex_ : 0;
		this.ElementIndex = ElementIndex_ !== undefined ? ElementIndex_ : 0;
		this.ExtraPolicyStatus = ExtraPolicyStatus_ !== undefined ? ExtraPolicyStatus_ : 0;
	});
	go$pkg.CertChainPolicyStatus = CertChainPolicyStatus;
	var AddrinfoW;
	AddrinfoW = go$newType(0, "Struct", "syscall.AddrinfoW", "AddrinfoW", "syscall", function(Flags_, Family_, Socktype_, Protocol_, Addrlen_, Canonname_, Addr_, Next_) {
		this.go$val = this;
		this.Flags = Flags_ !== undefined ? Flags_ : 0;
		this.Family = Family_ !== undefined ? Family_ : 0;
		this.Socktype = Socktype_ !== undefined ? Socktype_ : 0;
		this.Protocol = Protocol_ !== undefined ? Protocol_ : 0;
		this.Addrlen = Addrlen_ !== undefined ? Addrlen_ : 0;
		this.Canonname = Canonname_ !== undefined ? Canonname_ : (go$ptrType(Go$Uint16)).nil;
		this.Addr = Addr_ !== undefined ? Addr_ : 0;
		this.Next = Next_ !== undefined ? Next_ : (go$ptrType(AddrinfoW)).nil;
	});
	go$pkg.AddrinfoW = AddrinfoW;
	var GUID;
	GUID = go$newType(0, "Struct", "syscall.GUID", "GUID", "syscall", function(Data1_, Data2_, Data3_, Data4_) {
		this.go$val = this;
		this.Data1 = Data1_ !== undefined ? Data1_ : 0;
		this.Data2 = Data2_ !== undefined ? Data2_ : 0;
		this.Data3 = Data3_ !== undefined ? Data3_ : 0;
		this.Data4 = Data4_ !== undefined ? Data4_ : go$makeNativeArray("Uint8", 8, function() { return 0; });
	});
	go$pkg.GUID = GUID;
	var WSAProtocolInfo;
	WSAProtocolInfo = go$newType(0, "Struct", "syscall.WSAProtocolInfo", "WSAProtocolInfo", "syscall", function(ServiceFlags1_, ServiceFlags2_, ServiceFlags3_, ServiceFlags4_, ProviderFlags_, ProviderId_, CatalogEntryId_, ProtocolChain_, Version_, AddressFamily_, MaxSockAddr_, MinSockAddr_, SocketType_, Protocol_, ProtocolMaxOffset_, NetworkByteOrder_, SecurityScheme_, MessageSize_, ProviderReserved_, ProtocolName_) {
		this.go$val = this;
		this.ServiceFlags1 = ServiceFlags1_ !== undefined ? ServiceFlags1_ : 0;
		this.ServiceFlags2 = ServiceFlags2_ !== undefined ? ServiceFlags2_ : 0;
		this.ServiceFlags3 = ServiceFlags3_ !== undefined ? ServiceFlags3_ : 0;
		this.ServiceFlags4 = ServiceFlags4_ !== undefined ? ServiceFlags4_ : 0;
		this.ProviderFlags = ProviderFlags_ !== undefined ? ProviderFlags_ : 0;
		this.ProviderId = ProviderId_ !== undefined ? ProviderId_ : new GUID.Ptr();
		this.CatalogEntryId = CatalogEntryId_ !== undefined ? CatalogEntryId_ : 0;
		this.ProtocolChain = ProtocolChain_ !== undefined ? ProtocolChain_ : new WSAProtocolChain.Ptr();
		this.Version = Version_ !== undefined ? Version_ : 0;
		this.AddressFamily = AddressFamily_ !== undefined ? AddressFamily_ : 0;
		this.MaxSockAddr = MaxSockAddr_ !== undefined ? MaxSockAddr_ : 0;
		this.MinSockAddr = MinSockAddr_ !== undefined ? MinSockAddr_ : 0;
		this.SocketType = SocketType_ !== undefined ? SocketType_ : 0;
		this.Protocol = Protocol_ !== undefined ? Protocol_ : 0;
		this.ProtocolMaxOffset = ProtocolMaxOffset_ !== undefined ? ProtocolMaxOffset_ : 0;
		this.NetworkByteOrder = NetworkByteOrder_ !== undefined ? NetworkByteOrder_ : 0;
		this.SecurityScheme = SecurityScheme_ !== undefined ? SecurityScheme_ : 0;
		this.MessageSize = MessageSize_ !== undefined ? MessageSize_ : 0;
		this.ProviderReserved = ProviderReserved_ !== undefined ? ProviderReserved_ : 0;
		this.ProtocolName = ProtocolName_ !== undefined ? ProtocolName_ : go$makeNativeArray("Uint16", 256, function() { return 0; });
	});
	go$pkg.WSAProtocolInfo = WSAProtocolInfo;
	var WSAProtocolChain;
	WSAProtocolChain = go$newType(0, "Struct", "syscall.WSAProtocolChain", "WSAProtocolChain", "syscall", function(ChainLen_, ChainEntries_) {
		this.go$val = this;
		this.ChainLen = ChainLen_ !== undefined ? ChainLen_ : 0;
		this.ChainEntries = ChainEntries_ !== undefined ? ChainEntries_ : go$makeNativeArray("Uint32", 7, function() { return 0; });
	});
	go$pkg.WSAProtocolChain = WSAProtocolChain;
	var WSAData;
	WSAData = go$newType(0, "Struct", "syscall.WSAData", "WSAData", "syscall", function(Version_, HighVersion_, MaxSockets_, MaxUdpDg_, VendorInfo_, Description_, SystemStatus_) {
		this.go$val = this;
		this.Version = Version_ !== undefined ? Version_ : 0;
		this.HighVersion = HighVersion_ !== undefined ? HighVersion_ : 0;
		this.MaxSockets = MaxSockets_ !== undefined ? MaxSockets_ : 0;
		this.MaxUdpDg = MaxUdpDg_ !== undefined ? MaxUdpDg_ : 0;
		this.VendorInfo = VendorInfo_ !== undefined ? VendorInfo_ : (go$ptrType(Go$Uint8)).nil;
		this.Description = Description_ !== undefined ? Description_ : go$makeNativeArray("Uint8", 257, function() { return 0; });
		this.SystemStatus = SystemStatus_ !== undefined ? SystemStatus_ : go$makeNativeArray("Uint8", 129, function() { return 0; });
	});
	go$pkg.WSAData = WSAData;
	var Servent;
	Servent = go$newType(0, "Struct", "syscall.Servent", "Servent", "syscall", function(Name_, Aliases_, Proto_, Port_) {
		this.go$val = this;
		this.Name = Name_ !== undefined ? Name_ : (go$ptrType(Go$Uint8)).nil;
		this.Aliases = Aliases_ !== undefined ? Aliases_ : (go$ptrType((go$ptrType(Go$Uint8)))).nil;
		this.Proto = Proto_ !== undefined ? Proto_ : (go$ptrType(Go$Uint8)).nil;
		this.Port = Port_ !== undefined ? Port_ : 0;
	});
	go$pkg.Servent = Servent;
	DLLError.init([["Err", "", go$error, ""], ["ObjName", "", Go$String, ""], ["Msg", "", Go$String, ""]]);
	(go$ptrType(DLLError)).methods = [["Error", "", [], [Go$String], false]];
	DLL.init([["Name", "", Go$String, ""], ["Handle", "", Handle, ""]]);
	(go$ptrType(DLL)).methods = [["FindProc", "", [Go$String], [(go$ptrType(Proc)), go$error], false], ["MustFindProc", "", [Go$String], [(go$ptrType(Proc))], false], ["Release", "", [], [go$error], false]];
	Proc.init([["Dll", "", (go$ptrType(DLL)), ""], ["Name", "", Go$String, ""], ["addr", "syscall", Go$Uintptr, ""]]);
	(go$ptrType(Proc)).methods = [["Addr", "", [], [Go$Uintptr], false], ["Call", "", [(go$sliceType(Go$Uintptr))], [Go$Uintptr, Go$Uintptr, go$error], true]];
	LazyDLL.init([["mu", "syscall", sync.Mutex, ""], ["dll", "syscall", (go$ptrType(DLL)), ""], ["Name", "", Go$String, ""]]);
	(go$ptrType(LazyDLL)).methods = [["Handle", "", [], [Go$Uintptr], false], ["Load", "", [], [go$error], false], ["NewProc", "", [Go$String], [(go$ptrType(LazyProc))], false], ["mustLoad", "syscall", [], [], false]];
	LazyProc.init([["mu", "syscall", sync.Mutex, ""], ["Name", "", Go$String, ""], ["l", "syscall", (go$ptrType(LazyDLL)), ""], ["proc", "syscall", (go$ptrType(Proc)), ""]]);
	(go$ptrType(LazyProc)).methods = [["Addr", "", [], [Go$Uintptr], false], ["Call", "", [(go$sliceType(Go$Uintptr))], [Go$Uintptr, Go$Uintptr, go$error], true], ["Find", "", [], [go$error], false], ["mustFind", "syscall", [], [], false]];
	ProcAttr.init([["Dir", "", Go$String, ""], ["Env", "", (go$sliceType(Go$String)), ""], ["Files", "", (go$sliceType(Go$Uintptr)), ""], ["Sys", "", (go$ptrType(SysProcAttr)), ""]]);
	SysProcAttr.init([["HideWindow", "", Go$Bool, ""], ["CmdLine", "", Go$String, ""], ["CreationFlags", "", Go$Uint32, ""]]);
	UserInfo10.init([["Name", "", (go$ptrType(Go$Uint16)), ""], ["Comment", "", (go$ptrType(Go$Uint16)), ""], ["UsrComment", "", (go$ptrType(Go$Uint16)), ""], ["FullName", "", (go$ptrType(Go$Uint16)), ""]]);
	SID.init([]);
	(go$ptrType(SID)).methods = [["Copy", "", [], [(go$ptrType(SID)), go$error], false], ["Len", "", [], [Go$Int], false], ["LookupAccount", "", [Go$String], [Go$String, Go$String, Go$Uint32, go$error], false], ["String", "", [], [Go$String, go$error], false]];
	SIDAndAttributes.init([["Sid", "", (go$ptrType(SID)), ""], ["Attributes", "", Go$Uint32, ""]]);
	Tokenuser.init([["User", "", SIDAndAttributes, ""]]);
	Tokenprimarygroup.init([["PrimaryGroup", "", (go$ptrType(SID)), ""]]);
	Token.methods = [["Close", "", [], [go$error], false], ["GetTokenPrimaryGroup", "", [], [(go$ptrType(Tokenprimarygroup)), go$error], false], ["GetTokenUser", "", [], [(go$ptrType(Tokenuser)), go$error], false], ["GetUserProfileDirectory", "", [], [Go$String, go$error], false], ["getInfo", "syscall", [Go$Uint32, Go$Int], [Go$UnsafePointer, go$error], false]];
	(go$ptrType(Token)).methods = [["Close", "", [], [go$error], false], ["GetTokenPrimaryGroup", "", [], [(go$ptrType(Tokenprimarygroup)), go$error], false], ["GetTokenUser", "", [], [(go$ptrType(Tokenuser)), go$error], false], ["GetUserProfileDirectory", "", [], [Go$String, go$error], false], ["getInfo", "syscall", [Go$Uint32, Go$Int], [Go$UnsafePointer, go$error], false]];
	Errno.methods = [["Error", "", [], [Go$String], false], ["Temporary", "", [], [Go$Bool], false], ["Timeout", "", [], [Go$Bool], false]];
	(go$ptrType(Errno)).methods = [["Error", "", [], [Go$String], false], ["Temporary", "", [], [Go$Bool], false], ["Timeout", "", [], [Go$Bool], false]];
	RawSockaddrInet4.init([["Family", "", Go$Uint16, ""], ["Port", "", Go$Uint16, ""], ["Addr", "", (go$arrayType(Go$Uint8, 4)), ""], ["Zero", "", (go$arrayType(Go$Uint8, 8)), ""]]);
	RawSockaddrInet6.init([["Family", "", Go$Uint16, ""], ["Port", "", Go$Uint16, ""], ["Flowinfo", "", Go$Uint32, ""], ["Addr", "", (go$arrayType(Go$Uint8, 16)), ""], ["Scope_id", "", Go$Uint32, ""]]);
	RawSockaddr.init([["Family", "", Go$Uint16, ""], ["Data", "", (go$arrayType(Go$Int8, 14)), ""]]);
	RawSockaddrAny.init([["Addr", "", RawSockaddr, ""], ["Pad", "", (go$arrayType(Go$Int8, 96)), ""]]);
	(go$ptrType(RawSockaddrAny)).methods = [["Sockaddr", "", [], [Sockaddr, go$error], false]];
	Sockaddr.init([["sockaddr", "syscall", (go$funcType([], [Go$Uintptr, Go$Int32, go$error], false))]]);
	SockaddrInet4.init([["Port", "", Go$Int, ""], ["Addr", "", (go$arrayType(Go$Uint8, 4)), ""], ["raw", "syscall", RawSockaddrInet4, ""]]);
	(go$ptrType(SockaddrInet4)).methods = [["sockaddr", "syscall", [], [Go$Uintptr, Go$Int32, go$error], false]];
	SockaddrInet6.init([["Port", "", Go$Int, ""], ["ZoneId", "", Go$Uint32, ""], ["Addr", "", (go$arrayType(Go$Uint8, 16)), ""], ["raw", "syscall", RawSockaddrInet6, ""]]);
	(go$ptrType(SockaddrInet6)).methods = [["sockaddr", "syscall", [], [Go$Uintptr, Go$Int32, go$error], false]];
	SockaddrUnix.init([["Name", "", Go$String, ""]]);
	(go$ptrType(SockaddrUnix)).methods = [["sockaddr", "syscall", [], [Go$Uintptr, Go$Int32, go$error], false]];
	Rusage.init([["CreationTime", "", Filetime, ""], ["ExitTime", "", Filetime, ""], ["KernelTime", "", Filetime, ""], ["UserTime", "", Filetime, ""]]);
	WaitStatus.init([["ExitCode", "", Go$Uint32, ""]]);
	WaitStatus.methods = [["Continued", "", [], [Go$Bool], false], ["CoreDump", "", [], [Go$Bool], false], ["ExitStatus", "", [], [Go$Int], false], ["Exited", "", [], [Go$Bool], false], ["Signal", "", [], [Signal], false], ["Signaled", "", [], [Go$Bool], false], ["StopSignal", "", [], [Signal], false], ["Stopped", "", [], [Go$Bool], false], ["TrapCause", "", [], [Go$Int], false]];
	(go$ptrType(WaitStatus)).methods = [["Continued", "", [], [Go$Bool], false], ["CoreDump", "", [], [Go$Bool], false], ["ExitStatus", "", [], [Go$Int], false], ["Exited", "", [], [Go$Bool], false], ["Signal", "", [], [Signal], false], ["Signaled", "", [], [Go$Bool], false], ["StopSignal", "", [], [Signal], false], ["Stopped", "", [], [Go$Bool], false], ["TrapCause", "", [], [Go$Int], false]];
	Timespec.init([["Sec", "", Go$Int64, ""], ["Nsec", "", Go$Int64, ""]]);
	(go$ptrType(Timespec)).methods = [["Nano", "", [], [Go$Int64], false], ["Unix", "", [], [Go$Int64, Go$Int64], false]];
	Linger.init([["Onoff", "", Go$Int32, ""], ["Linger", "", Go$Int32, ""]]);
	sysLinger.init([["Onoff", "", Go$Uint16, ""], ["Linger", "", Go$Uint16, ""]]);
	IPMreq.init([["Multiaddr", "", (go$arrayType(Go$Uint8, 4)), ""], ["Interface", "", (go$arrayType(Go$Uint8, 4)), ""]]);
	IPv6Mreq.init([["Multiaddr", "", (go$arrayType(Go$Uint8, 16)), ""], ["Interface", "", Go$Uint32, ""]]);
	Signal.methods = [["Signal", "", [], [], false], ["String", "", [], [Go$String], false]];
	(go$ptrType(Signal)).methods = [["Signal", "", [], [], false], ["String", "", [], [Go$String], false]];
	Timeval.init([["Sec", "", Go$Int32, ""], ["Usec", "", Go$Int32, ""]]);
	(go$ptrType(Timeval)).methods = [["Nano", "", [], [Go$Int64], false], ["Nanoseconds", "", [], [Go$Int64], false], ["Unix", "", [], [Go$Int64, Go$Int64], false]];
	SecurityAttributes.init([["Length", "", Go$Uint32, ""], ["SecurityDescriptor", "", Go$Uintptr, ""], ["InheritHandle", "", Go$Uint32, ""]]);
	Overlapped.init([["Internal", "", Go$Uintptr, ""], ["InternalHigh", "", Go$Uintptr, ""], ["Offset", "", Go$Uint32, ""], ["OffsetHigh", "", Go$Uint32, ""], ["HEvent", "", Handle, ""]]);
	FileNotifyInformation.init([["NextEntryOffset", "", Go$Uint32, ""], ["Action", "", Go$Uint32, ""], ["FileNameLength", "", Go$Uint32, ""], ["FileName", "", Go$Uint16, ""]]);
	Filetime.init([["LowDateTime", "", Go$Uint32, ""], ["HighDateTime", "", Go$Uint32, ""]]);
	(go$ptrType(Filetime)).methods = [["Nanoseconds", "", [], [Go$Int64], false]];
	Win32finddata.init([["FileAttributes", "", Go$Uint32, ""], ["CreationTime", "", Filetime, ""], ["LastAccessTime", "", Filetime, ""], ["LastWriteTime", "", Filetime, ""], ["FileSizeHigh", "", Go$Uint32, ""], ["FileSizeLow", "", Go$Uint32, ""], ["Reserved0", "", Go$Uint32, ""], ["Reserved1", "", Go$Uint32, ""], ["FileName", "", (go$arrayType(Go$Uint16, 259)), ""], ["AlternateFileName", "", (go$arrayType(Go$Uint16, 13)), ""]]);
	win32finddata1.init([["FileAttributes", "", Go$Uint32, ""], ["CreationTime", "", Filetime, ""], ["LastAccessTime", "", Filetime, ""], ["LastWriteTime", "", Filetime, ""], ["FileSizeHigh", "", Go$Uint32, ""], ["FileSizeLow", "", Go$Uint32, ""], ["Reserved0", "", Go$Uint32, ""], ["Reserved1", "", Go$Uint32, ""], ["FileName", "", (go$arrayType(Go$Uint16, 260)), ""], ["AlternateFileName", "", (go$arrayType(Go$Uint16, 14)), ""]]);
	ByHandleFileInformation.init([["FileAttributes", "", Go$Uint32, ""], ["CreationTime", "", Filetime, ""], ["LastAccessTime", "", Filetime, ""], ["LastWriteTime", "", Filetime, ""], ["VolumeSerialNumber", "", Go$Uint32, ""], ["FileSizeHigh", "", Go$Uint32, ""], ["FileSizeLow", "", Go$Uint32, ""], ["NumberOfLinks", "", Go$Uint32, ""], ["FileIndexHigh", "", Go$Uint32, ""], ["FileIndexLow", "", Go$Uint32, ""]]);
	Win32FileAttributeData.init([["FileAttributes", "", Go$Uint32, ""], ["CreationTime", "", Filetime, ""], ["LastAccessTime", "", Filetime, ""], ["LastWriteTime", "", Filetime, ""], ["FileSizeHigh", "", Go$Uint32, ""], ["FileSizeLow", "", Go$Uint32, ""]]);
	StartupInfo.init([["Cb", "", Go$Uint32, ""], ["_", "syscall", (go$ptrType(Go$Uint16)), ""], ["Desktop", "", (go$ptrType(Go$Uint16)), ""], ["Title", "", (go$ptrType(Go$Uint16)), ""], ["X", "", Go$Uint32, ""], ["Y", "", Go$Uint32, ""], ["XSize", "", Go$Uint32, ""], ["YSize", "", Go$Uint32, ""], ["XCountChars", "", Go$Uint32, ""], ["YCountChars", "", Go$Uint32, ""], ["FillAttribute", "", Go$Uint32, ""], ["Flags", "", Go$Uint32, ""], ["ShowWindow", "", Go$Uint16, ""], ["_", "syscall", Go$Uint16, ""], ["_", "syscall", (go$ptrType(Go$Uint8)), ""], ["StdInput", "", Handle, ""], ["StdOutput", "", Handle, ""], ["StdErr", "", Handle, ""]]);
	ProcessInformation.init([["Process", "", Handle, ""], ["Thread", "", Handle, ""], ["ProcessId", "", Go$Uint32, ""], ["ThreadId", "", Go$Uint32, ""]]);
	Systemtime.init([["Year", "", Go$Uint16, ""], ["Month", "", Go$Uint16, ""], ["DayOfWeek", "", Go$Uint16, ""], ["Day", "", Go$Uint16, ""], ["Hour", "", Go$Uint16, ""], ["Minute", "", Go$Uint16, ""], ["Second", "", Go$Uint16, ""], ["Milliseconds", "", Go$Uint16, ""]]);
	Timezoneinformation.init([["Bias", "", Go$Int32, ""], ["StandardName", "", (go$arrayType(Go$Uint16, 32)), ""], ["StandardDate", "", Systemtime, ""], ["StandardBias", "", Go$Int32, ""], ["DaylightName", "", (go$arrayType(Go$Uint16, 32)), ""], ["DaylightDate", "", Systemtime, ""], ["DaylightBias", "", Go$Int32, ""]]);
	WSABuf.init([["Len", "", Go$Uint32, ""], ["Buf", "", (go$ptrType(Go$Uint8)), ""]]);
	Hostent.init([["Name", "", (go$ptrType(Go$Uint8)), ""], ["Aliases", "", (go$ptrType((go$ptrType(Go$Uint8)))), ""], ["AddrType", "", Go$Uint16, ""], ["Length", "", Go$Uint16, ""], ["AddrList", "", (go$ptrType((go$ptrType(Go$Uint8)))), ""]]);
	Protoent.init([["Name", "", (go$ptrType(Go$Uint8)), ""], ["Aliases", "", (go$ptrType((go$ptrType(Go$Uint8)))), ""], ["Proto", "", Go$Uint16, ""]]);
	DNSSRVData.init([["Target", "", (go$ptrType(Go$Uint16)), ""], ["Priority", "", Go$Uint16, ""], ["Weight", "", Go$Uint16, ""], ["Port", "", Go$Uint16, ""], ["Pad", "", Go$Uint16, ""]]);
	DNSPTRData.init([["Host", "", (go$ptrType(Go$Uint16)), ""]]);
	DNSMXData.init([["NameExchange", "", (go$ptrType(Go$Uint16)), ""], ["Preference", "", Go$Uint16, ""], ["Pad", "", Go$Uint16, ""]]);
	DNSTXTData.init([["StringCount", "", Go$Uint16, ""], ["StringArray", "", (go$arrayType((go$ptrType(Go$Uint16)), 1)), ""]]);
	DNSRecord.init([["Next", "", (go$ptrType(DNSRecord)), ""], ["Name", "", (go$ptrType(Go$Uint16)), ""], ["Type", "", Go$Uint16, ""], ["Length", "", Go$Uint16, ""], ["Dw", "", Go$Uint32, ""], ["Ttl", "", Go$Uint32, ""], ["Reserved", "", Go$Uint32, ""], ["Data", "", (go$arrayType(Go$Uint8, 40)), ""]]);
	TransmitFileBuffers.init([["Head", "", Go$Uintptr, ""], ["HeadLength", "", Go$Uint32, ""], ["Tail", "", Go$Uintptr, ""], ["TailLength", "", Go$Uint32, ""]]);
	SockaddrGen.init(Go$Uint8, 24);
	InterfaceInfo.init([["Flags", "", Go$Uint32, ""], ["Address", "", SockaddrGen, ""], ["BroadcastAddress", "", SockaddrGen, ""], ["Netmask", "", SockaddrGen, ""]]);
	IpAddressString.init([["String", "", (go$arrayType(Go$Uint8, 16)), ""]]);
	IpMaskString.init([["String", "", (go$arrayType(Go$Uint8, 16)), ""]]);
	IpAddrString.init([["Next", "", (go$ptrType(IpAddrString)), ""], ["IpAddress", "", IpAddressString, ""], ["IpMask", "", IpMaskString, ""], ["Context", "", Go$Uint32, ""]]);
	IpAdapterInfo.init([["Next", "", (go$ptrType(IpAdapterInfo)), ""], ["ComboIndex", "", Go$Uint32, ""], ["AdapterName", "", (go$arrayType(Go$Uint8, 260)), ""], ["Description", "", (go$arrayType(Go$Uint8, 132)), ""], ["AddressLength", "", Go$Uint32, ""], ["Address", "", (go$arrayType(Go$Uint8, 8)), ""], ["Index", "", Go$Uint32, ""], ["Type", "", Go$Uint32, ""], ["DhcpEnabled", "", Go$Uint32, ""], ["CurrentIpAddress", "", (go$ptrType(IpAddrString)), ""], ["IpAddressList", "", IpAddrString, ""], ["GatewayList", "", IpAddrString, ""], ["DhcpServer", "", IpAddrString, ""], ["HaveWins", "", Go$Bool, ""], ["PrimaryWinsServer", "", IpAddrString, ""], ["SecondaryWinsServer", "", IpAddrString, ""], ["LeaseObtained", "", Go$Int64, ""], ["LeaseExpires", "", Go$Int64, ""]]);
	MibIfRow.init([["Name", "", (go$arrayType(Go$Uint16, 256)), ""], ["Index", "", Go$Uint32, ""], ["Type", "", Go$Uint32, ""], ["Mtu", "", Go$Uint32, ""], ["Speed", "", Go$Uint32, ""], ["PhysAddrLen", "", Go$Uint32, ""], ["PhysAddr", "", (go$arrayType(Go$Uint8, 8)), ""], ["AdminStatus", "", Go$Uint32, ""], ["OperStatus", "", Go$Uint32, ""], ["LastChange", "", Go$Uint32, ""], ["InOctets", "", Go$Uint32, ""], ["InUcastPkts", "", Go$Uint32, ""], ["InNUcastPkts", "", Go$Uint32, ""], ["InDiscards", "", Go$Uint32, ""], ["InErrors", "", Go$Uint32, ""], ["InUnknownProtos", "", Go$Uint32, ""], ["OutOctets", "", Go$Uint32, ""], ["OutUcastPkts", "", Go$Uint32, ""], ["OutNUcastPkts", "", Go$Uint32, ""], ["OutDiscards", "", Go$Uint32, ""], ["OutErrors", "", Go$Uint32, ""], ["OutQLen", "", Go$Uint32, ""], ["DescrLen", "", Go$Uint32, ""], ["Descr", "", (go$arrayType(Go$Uint8, 256)), ""]]);
	CertContext.init([["EncodingType", "", Go$Uint32, ""], ["EncodedCert", "", (go$ptrType(Go$Uint8)), ""], ["Length", "", Go$Uint32, ""], ["CertInfo", "", Go$Uintptr, ""], ["Store", "", Handle, ""]]);
	CertChainContext.init([["Size", "", Go$Uint32, ""], ["TrustStatus", "", CertTrustStatus, ""], ["ChainCount", "", Go$Uint32, ""], ["Chains", "", (go$ptrType((go$ptrType(CertSimpleChain)))), ""], ["LowerQualityChainCount", "", Go$Uint32, ""], ["LowerQualityChains", "", (go$ptrType((go$ptrType(CertChainContext)))), ""], ["HasRevocationFreshnessTime", "", Go$Uint32, ""], ["RevocationFreshnessTime", "", Go$Uint32, ""]]);
	CertSimpleChain.init([["Size", "", Go$Uint32, ""], ["TrustStatus", "", CertTrustStatus, ""], ["NumElements", "", Go$Uint32, ""], ["Elements", "", (go$ptrType((go$ptrType(CertChainElement)))), ""], ["TrustListInfo", "", Go$Uintptr, ""], ["HasRevocationFreshnessTime", "", Go$Uint32, ""], ["RevocationFreshnessTime", "", Go$Uint32, ""]]);
	CertChainElement.init([["Size", "", Go$Uint32, ""], ["CertContext", "", (go$ptrType(CertContext)), ""], ["TrustStatus", "", CertTrustStatus, ""], ["RevocationInfo", "", (go$ptrType(CertRevocationInfo)), ""], ["IssuanceUsage", "", (go$ptrType(CertEnhKeyUsage)), ""], ["ApplicationUsage", "", (go$ptrType(CertEnhKeyUsage)), ""], ["ExtendedErrorInfo", "", (go$ptrType(Go$Uint16)), ""]]);
	CertRevocationInfo.init([["Size", "", Go$Uint32, ""], ["RevocationResult", "", Go$Uint32, ""], ["RevocationOid", "", (go$ptrType(Go$Uint8)), ""], ["OidSpecificInfo", "", Go$Uintptr, ""], ["HasFreshnessTime", "", Go$Uint32, ""], ["FreshnessTime", "", Go$Uint32, ""], ["CrlInfo", "", Go$Uintptr, ""]]);
	CertTrustStatus.init([["ErrorStatus", "", Go$Uint32, ""], ["InfoStatus", "", Go$Uint32, ""]]);
	CertUsageMatch.init([["Type", "", Go$Uint32, ""], ["Usage", "", CertEnhKeyUsage, ""]]);
	CertEnhKeyUsage.init([["Length", "", Go$Uint32, ""], ["UsageIdentifiers", "", (go$ptrType((go$ptrType(Go$Uint8)))), ""]]);
	CertChainPara.init([["Size", "", Go$Uint32, ""], ["RequestedUsage", "", CertUsageMatch, ""], ["RequstedIssuancePolicy", "", CertUsageMatch, ""], ["URLRetrievalTimeout", "", Go$Uint32, ""], ["CheckRevocationFreshnessTime", "", Go$Uint32, ""], ["RevocationFreshnessTime", "", Go$Uint32, ""], ["CacheResync", "", (go$ptrType(Filetime)), ""]]);
	CertChainPolicyPara.init([["Size", "", Go$Uint32, ""], ["Flags", "", Go$Uint32, ""], ["ExtraPolicyPara", "", Go$Uintptr, ""]]);
	SSLExtraCertChainPolicyPara.init([["Size", "", Go$Uint32, ""], ["AuthType", "", Go$Uint32, ""], ["Checks", "", Go$Uint32, ""], ["ServerName", "", (go$ptrType(Go$Uint16)), ""]]);
	CertChainPolicyStatus.init([["Size", "", Go$Uint32, ""], ["Error", "", Go$Uint32, ""], ["ChainIndex", "", Go$Uint32, ""], ["ElementIndex", "", Go$Uint32, ""], ["ExtraPolicyStatus", "", Go$Uintptr, ""]]);
	AddrinfoW.init([["Flags", "", Go$Int32, ""], ["Family", "", Go$Int32, ""], ["Socktype", "", Go$Int32, ""], ["Protocol", "", Go$Int32, ""], ["Addrlen", "", Go$Uintptr, ""], ["Canonname", "", (go$ptrType(Go$Uint16)), ""], ["Addr", "", Go$Uintptr, ""], ["Next", "", (go$ptrType(AddrinfoW)), ""]]);
	GUID.init([["Data1", "", Go$Uint32, ""], ["Data2", "", Go$Uint16, ""], ["Data3", "", Go$Uint16, ""], ["Data4", "", (go$arrayType(Go$Uint8, 8)), ""]]);
	WSAProtocolInfo.init([["ServiceFlags1", "", Go$Uint32, ""], ["ServiceFlags2", "", Go$Uint32, ""], ["ServiceFlags3", "", Go$Uint32, ""], ["ServiceFlags4", "", Go$Uint32, ""], ["ProviderFlags", "", Go$Uint32, ""], ["ProviderId", "", GUID, ""], ["CatalogEntryId", "", Go$Uint32, ""], ["ProtocolChain", "", WSAProtocolChain, ""], ["Version", "", Go$Int32, ""], ["AddressFamily", "", Go$Int32, ""], ["MaxSockAddr", "", Go$Int32, ""], ["MinSockAddr", "", Go$Int32, ""], ["SocketType", "", Go$Int32, ""], ["Protocol", "", Go$Int32, ""], ["ProtocolMaxOffset", "", Go$Int32, ""], ["NetworkByteOrder", "", Go$Int32, ""], ["SecurityScheme", "", Go$Int32, ""], ["MessageSize", "", Go$Uint32, ""], ["ProviderReserved", "", Go$Uint32, ""], ["ProtocolName", "", (go$arrayType(Go$Uint16, 256)), ""]]);
	WSAProtocolChain.init([["ChainLen", "", Go$Int32, ""], ["ChainEntries", "", (go$arrayType(Go$Uint32, 7)), ""]]);
	WSAData.init([["Version", "", Go$Uint16, ""], ["HighVersion", "", Go$Uint16, ""], ["MaxSockets", "", Go$Uint16, ""], ["MaxUdpDg", "", Go$Uint16, ""], ["VendorInfo", "", (go$ptrType(Go$Uint8)), ""], ["Description", "", (go$arrayType(Go$Uint8, 257)), ""], ["SystemStatus", "", (go$arrayType(Go$Uint8, 129)), ""]]);
	Servent.init([["Name", "", (go$ptrType(Go$Uint8)), ""], ["Aliases", "", (go$ptrType((go$ptrType(Go$Uint8)))), ""], ["Proto", "", (go$ptrType(Go$Uint8)), ""], ["Port", "", Go$Uint16, ""]]);
	var zeroProcAttr, zeroSysProcAttr, _zero, ioSync, connectExFunc, errors, modkernel32, modadvapi32, modshell32, modmswsock, modcrypt32, modws2_32, moddnsapi, modiphlpapi, modsecur32, modnetapi32, moduserenv, procGetLastError, procLoadLibraryW, procFreeLibrary, procGetProcAddress, procGetVersion, procFormatMessageW, procExitProcess, procCreateFileW, procReadFile, procWriteFile, procSetFilePointer, procCloseHandle, procGetStdHandle, procFindFirstFileW, procFindNextFileW, procFindClose, procGetFileInformationByHandle, procGetCurrentDirectoryW, procSetCurrentDirectoryW, procCreateDirectoryW, procRemoveDirectoryW, procDeleteFileW, procMoveFileW, procGetComputerNameW, procSetEndOfFile, procGetSystemTimeAsFileTime, procGetTimeZoneInformation, procCreateIoCompletionPort, procGetQueuedCompletionStatus, procPostQueuedCompletionStatus, procCancelIo, procCancelIoEx, procCreateProcessW, procOpenProcess, procTerminateProcess, procGetExitCodeProcess, procGetStartupInfoW, procGetCurrentProcess, procGetProcessTimes, procDuplicateHandle, procWaitForSingleObject, procGetTempPathW, procCreatePipe, procGetFileType, procCryptAcquireContextW, procCryptReleaseContext, procCryptGenRandom, procGetEnvironmentStringsW, procFreeEnvironmentStringsW, procGetEnvironmentVariableW, procSetEnvironmentVariableW, procSetFileTime, procGetFileAttributesW, procSetFileAttributesW, procGetFileAttributesExW, procGetCommandLineW, procCommandLineToArgvW, procLocalFree, procSetHandleInformation, procFlushFileBuffers, procGetFullPathNameW, procGetLongPathNameW, procGetShortPathNameW, procCreateFileMappingW, procMapViewOfFile, procUnmapViewOfFile, procFlushViewOfFile, procVirtualLock, procVirtualUnlock, procTransmitFile, procReadDirectoryChangesW, procCertOpenSystemStoreW, procCertOpenStore, procCertEnumCertificatesInStore, procCertAddCertificateContextToStore, procCertCloseStore, procCertGetCertificateChain, procCertFreeCertificateChain, procCertCreateCertificateContext, procCertFreeCertificateContext, procCertVerifyCertificateChainPolicy, procRegOpenKeyExW, procRegCloseKey, procRegQueryInfoKeyW, procRegEnumKeyExW, procRegQueryValueExW, procGetCurrentProcessId, procGetConsoleMode, procWriteConsoleW, procReadConsoleW, procWSAStartup, procWSACleanup, procWSAIoctl, procsocket, procsetsockopt, procgetsockopt, procbind, procconnect, procgetsockname, procgetpeername, proclisten, procshutdown, procclosesocket, procAcceptEx, procGetAcceptExSockaddrs, procWSARecv, procWSASend, procWSARecvFrom, procWSASendTo, procgethostbyname, procgetservbyname, procntohs, procgetprotobyname, procDnsQuery_W, procDnsRecordListFree, procGetAddrInfoW, procFreeAddrInfoW, procGetIfEntry, procGetAdaptersInfo, procSetFileCompletionNotificationModes, procWSAEnumProtocolsW, procTranslateNameW, procGetUserNameExW, procNetUserGetInfo, procNetGetJoinInformation, procNetApiBufferFree, procLookupAccountSidW, procLookupAccountNameW, procConvertSidToStringSidW, procConvertStringSidToSidW, procGetLengthSid, procCopySid, procOpenProcessToken, procGetTokenInformation, procGetUserProfileDirectoryW, signals;
	DLLError.Ptr.prototype.Error = function() {
		var e;
		e = this;
		return e.Msg;
	};
	DLLError.prototype.Error = function() { return this.go$val.Error(); };
	var Syscall = go$pkg.Syscall = function(trap, nargs, a1, a2, a3) {
		throw go$panic("Native function not implemented: Syscall");
	};
	var Syscall6 = go$pkg.Syscall6 = function(trap, nargs, a1, a2, a3, a4, a5, a6) {
		throw go$panic("Native function not implemented: Syscall6");
	};
	var Syscall9 = go$pkg.Syscall9 = function(trap, nargs, a1, a2, a3, a4, a5, a6, a7, a8, a9) {
		throw go$panic("Native function not implemented: Syscall9");
	};
	var Syscall12 = go$pkg.Syscall12 = function(trap, nargs, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12) {
		throw go$panic("Native function not implemented: Syscall12");
	};
	var Syscall15 = go$pkg.Syscall15 = function(trap, nargs, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15) {
		throw go$panic("Native function not implemented: Syscall15");
	};
	var loadlibrary = function(filename) {
		throw go$panic("Native function not implemented: loadlibrary");
	};
	var getprocaddress = function(handle, procname) {
		throw go$panic("Native function not implemented: getprocaddress");
	};
	var LoadDLL = go$pkg.LoadDLL = function(name) {
		var dll, err, _tuple, namep, _tuple$1, _tuple$2, h, e, _tuple$3, d, _tuple$4;
		dll = (go$ptrType(DLL)).nil;
		err = null;
		_tuple = UTF16PtrFromString(name), namep = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			_tuple$1 = [(go$ptrType(DLL)).nil, err], dll = _tuple$1[0], err = _tuple$1[1];
			return [dll, err];
		}
		_tuple$2 = loadlibrary(namep), h = _tuple$2[0], e = _tuple$2[1];
		if (!((e === 0))) {
			_tuple$3 = [(go$ptrType(DLL)).nil, new DLLError.Ptr(new Errno(e), name, "Failed to load " + name + ": " + (new Errno(e)).Error())], dll = _tuple$3[0], err = _tuple$3[1];
			return [dll, err];
		}
		d = new DLL.Ptr(name, (h >>> 0));
		_tuple$4 = [d, null], dll = _tuple$4[0], err = _tuple$4[1];
		return [dll, err];
	};
	var MustLoadDLL = go$pkg.MustLoadDLL = function(name) {
		var _tuple, d, e;
		_tuple = LoadDLL(name), d = _tuple[0], e = _tuple[1];
		if (!(go$interfaceIsEqual(e, null))) {
			throw go$panic(e);
		}
		return d;
	};
	DLL.Ptr.prototype.FindProc = function(name) {
		var proc, err, d, _tuple, namep, _tuple$1, _tuple$2, a, e, _tuple$3, p, _tuple$4;
		proc = (go$ptrType(Proc)).nil;
		err = null;
		d = this;
		_tuple = BytePtrFromString(name), namep = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			_tuple$1 = [(go$ptrType(Proc)).nil, err], proc = _tuple$1[0], err = _tuple$1[1];
			return [proc, err];
		}
		_tuple$2 = getprocaddress((d.Handle >>> 0), namep), a = _tuple$2[0], e = _tuple$2[1];
		if (!((e === 0))) {
			_tuple$3 = [(go$ptrType(Proc)).nil, new DLLError.Ptr(new Errno(e), name, "Failed to find " + name + " procedure in " + d.Name + ": " + (new Errno(e)).Error())], proc = _tuple$3[0], err = _tuple$3[1];
			return [proc, err];
		}
		p = new Proc.Ptr(d, name, a);
		_tuple$4 = [p, null], proc = _tuple$4[0], err = _tuple$4[1];
		return [proc, err];
	};
	DLL.prototype.FindProc = function(name) { return this.go$val.FindProc(name); };
	DLL.Ptr.prototype.MustFindProc = function(name) {
		var d, _tuple, p, e;
		d = this;
		_tuple = d.FindProc(name), p = _tuple[0], e = _tuple[1];
		if (!(go$interfaceIsEqual(e, null))) {
			throw go$panic(e);
		}
		return p;
	};
	DLL.prototype.MustFindProc = function(name) { return this.go$val.MustFindProc(name); };
	DLL.Ptr.prototype.Release = function() {
		var err, d;
		err = null;
		d = this;
		err = FreeLibrary(d.Handle);
		return err;
	};
	DLL.prototype.Release = function() { return this.go$val.Release(); };
	Proc.Ptr.prototype.Addr = function() {
		var p;
		p = this;
		return p.addr;
	};
	Proc.prototype.Addr = function() { return this.go$val.Addr(); };
	Proc.Ptr.prototype.Call = function(a) {
		var r1, r2, lastErr, p, _ref, _tuple, _tuple$1, _slice, _index, _tuple$2, _slice$1, _index$1, _slice$2, _index$2, _tuple$3, _slice$3, _index$3, _slice$4, _index$4, _slice$5, _index$5, _tuple$4, _slice$6, _index$6, _slice$7, _index$7, _slice$8, _index$8, _slice$9, _index$9, _tuple$5, _slice$10, _index$10, _slice$11, _index$11, _slice$12, _index$12, _slice$13, _index$13, _slice$14, _index$14, _tuple$6, _slice$15, _index$15, _slice$16, _index$16, _slice$17, _index$17, _slice$18, _index$18, _slice$19, _index$19, _slice$20, _index$20, _tuple$7, _slice$21, _index$21, _slice$22, _index$22, _slice$23, _index$23, _slice$24, _index$24, _slice$25, _index$25, _slice$26, _index$26, _slice$27, _index$27, _tuple$8, _slice$28, _index$28, _slice$29, _index$29, _slice$30, _index$30, _slice$31, _index$31, _slice$32, _index$32, _slice$33, _index$33, _slice$34, _index$34, _slice$35, _index$35, _tuple$9, _slice$36, _index$36, _slice$37, _index$37, _slice$38, _index$38, _slice$39, _index$39, _slice$40, _index$40, _slice$41, _index$41, _slice$42, _index$42, _slice$43, _index$43, _slice$44, _index$44, _tuple$10, _slice$45, _index$45, _slice$46, _index$46, _slice$47, _index$47, _slice$48, _index$48, _slice$49, _index$49, _slice$50, _index$50, _slice$51, _index$51, _slice$52, _index$52, _slice$53, _index$53, _slice$54, _index$54, _tuple$11, _slice$55, _index$55, _slice$56, _index$56, _slice$57, _index$57, _slice$58, _index$58, _slice$59, _index$59, _slice$60, _index$60, _slice$61, _index$61, _slice$62, _index$62, _slice$63, _index$63, _slice$64, _index$64, _slice$65, _index$65, _tuple$12, _slice$66, _index$66, _slice$67, _index$67, _slice$68, _index$68, _slice$69, _index$69, _slice$70, _index$70, _slice$71, _index$71, _slice$72, _index$72, _slice$73, _index$73, _slice$74, _index$74, _slice$75, _index$75, _slice$76, _index$76, _slice$77, _index$77, _tuple$13, _slice$78, _index$78, _slice$79, _index$79, _slice$80, _index$80, _slice$81, _index$81, _slice$82, _index$82, _slice$83, _index$83, _slice$84, _index$84, _slice$85, _index$85, _slice$86, _index$86, _slice$87, _index$87, _slice$88, _index$88, _slice$89, _index$89, _slice$90, _index$90, _tuple$14, _slice$91, _index$91, _slice$92, _index$92, _slice$93, _index$93, _slice$94, _index$94, _slice$95, _index$95, _slice$96, _index$96, _slice$97, _index$97, _slice$98, _index$98, _slice$99, _index$99, _slice$100, _index$100, _slice$101, _index$101, _slice$102, _index$102, _slice$103, _index$103, _slice$104, _index$104, _tuple$15, _slice$105, _index$105, _slice$106, _index$106, _slice$107, _index$107, _slice$108, _index$108, _slice$109, _index$109, _slice$110, _index$110, _slice$111, _index$111, _slice$112, _index$112, _slice$113, _index$113, _slice$114, _index$114, _slice$115, _index$115, _slice$116, _index$116, _slice$117, _index$117, _slice$118, _index$118, _slice$119, _index$119;
		r1 = 0;
		r2 = 0;
		lastErr = null;
		p = this;
		_ref = a.length;
		if (_ref === 0) {
			_tuple = Syscall(p.Addr(), (a.length >>> 0), 0, 0, 0), r1 = _tuple[0], r2 = _tuple[1], lastErr = new Errno(_tuple[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 1) {
			_tuple$1 = Syscall(p.Addr(), (a.length >>> 0), (_slice = a, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")), 0, 0), r1 = _tuple$1[0], r2 = _tuple$1[1], lastErr = new Errno(_tuple$1[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 2) {
			_tuple$2 = Syscall(p.Addr(), (a.length >>> 0), (_slice$1 = a, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")), (_slice$2 = a, _index$2 = 1, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")), 0), r1 = _tuple$2[0], r2 = _tuple$2[1], lastErr = new Errno(_tuple$2[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 3) {
			_tuple$3 = Syscall(p.Addr(), (a.length >>> 0), (_slice$3 = a, _index$3 = 0, (_index$3 >= 0 && _index$3 < _slice$3.length) ? _slice$3.array[_slice$3.offset + _index$3] : go$throwRuntimeError("index out of range")), (_slice$4 = a, _index$4 = 1, (_index$4 >= 0 && _index$4 < _slice$4.length) ? _slice$4.array[_slice$4.offset + _index$4] : go$throwRuntimeError("index out of range")), (_slice$5 = a, _index$5 = 2, (_index$5 >= 0 && _index$5 < _slice$5.length) ? _slice$5.array[_slice$5.offset + _index$5] : go$throwRuntimeError("index out of range"))), r1 = _tuple$3[0], r2 = _tuple$3[1], lastErr = new Errno(_tuple$3[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 4) {
			_tuple$4 = Syscall6(p.Addr(), (a.length >>> 0), (_slice$6 = a, _index$6 = 0, (_index$6 >= 0 && _index$6 < _slice$6.length) ? _slice$6.array[_slice$6.offset + _index$6] : go$throwRuntimeError("index out of range")), (_slice$7 = a, _index$7 = 1, (_index$7 >= 0 && _index$7 < _slice$7.length) ? _slice$7.array[_slice$7.offset + _index$7] : go$throwRuntimeError("index out of range")), (_slice$8 = a, _index$8 = 2, (_index$8 >= 0 && _index$8 < _slice$8.length) ? _slice$8.array[_slice$8.offset + _index$8] : go$throwRuntimeError("index out of range")), (_slice$9 = a, _index$9 = 3, (_index$9 >= 0 && _index$9 < _slice$9.length) ? _slice$9.array[_slice$9.offset + _index$9] : go$throwRuntimeError("index out of range")), 0, 0), r1 = _tuple$4[0], r2 = _tuple$4[1], lastErr = new Errno(_tuple$4[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 5) {
			_tuple$5 = Syscall6(p.Addr(), (a.length >>> 0), (_slice$10 = a, _index$10 = 0, (_index$10 >= 0 && _index$10 < _slice$10.length) ? _slice$10.array[_slice$10.offset + _index$10] : go$throwRuntimeError("index out of range")), (_slice$11 = a, _index$11 = 1, (_index$11 >= 0 && _index$11 < _slice$11.length) ? _slice$11.array[_slice$11.offset + _index$11] : go$throwRuntimeError("index out of range")), (_slice$12 = a, _index$12 = 2, (_index$12 >= 0 && _index$12 < _slice$12.length) ? _slice$12.array[_slice$12.offset + _index$12] : go$throwRuntimeError("index out of range")), (_slice$13 = a, _index$13 = 3, (_index$13 >= 0 && _index$13 < _slice$13.length) ? _slice$13.array[_slice$13.offset + _index$13] : go$throwRuntimeError("index out of range")), (_slice$14 = a, _index$14 = 4, (_index$14 >= 0 && _index$14 < _slice$14.length) ? _slice$14.array[_slice$14.offset + _index$14] : go$throwRuntimeError("index out of range")), 0), r1 = _tuple$5[0], r2 = _tuple$5[1], lastErr = new Errno(_tuple$5[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 6) {
			_tuple$6 = Syscall6(p.Addr(), (a.length >>> 0), (_slice$15 = a, _index$15 = 0, (_index$15 >= 0 && _index$15 < _slice$15.length) ? _slice$15.array[_slice$15.offset + _index$15] : go$throwRuntimeError("index out of range")), (_slice$16 = a, _index$16 = 1, (_index$16 >= 0 && _index$16 < _slice$16.length) ? _slice$16.array[_slice$16.offset + _index$16] : go$throwRuntimeError("index out of range")), (_slice$17 = a, _index$17 = 2, (_index$17 >= 0 && _index$17 < _slice$17.length) ? _slice$17.array[_slice$17.offset + _index$17] : go$throwRuntimeError("index out of range")), (_slice$18 = a, _index$18 = 3, (_index$18 >= 0 && _index$18 < _slice$18.length) ? _slice$18.array[_slice$18.offset + _index$18] : go$throwRuntimeError("index out of range")), (_slice$19 = a, _index$19 = 4, (_index$19 >= 0 && _index$19 < _slice$19.length) ? _slice$19.array[_slice$19.offset + _index$19] : go$throwRuntimeError("index out of range")), (_slice$20 = a, _index$20 = 5, (_index$20 >= 0 && _index$20 < _slice$20.length) ? _slice$20.array[_slice$20.offset + _index$20] : go$throwRuntimeError("index out of range"))), r1 = _tuple$6[0], r2 = _tuple$6[1], lastErr = new Errno(_tuple$6[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 7) {
			_tuple$7 = Syscall9(p.Addr(), (a.length >>> 0), (_slice$21 = a, _index$21 = 0, (_index$21 >= 0 && _index$21 < _slice$21.length) ? _slice$21.array[_slice$21.offset + _index$21] : go$throwRuntimeError("index out of range")), (_slice$22 = a, _index$22 = 1, (_index$22 >= 0 && _index$22 < _slice$22.length) ? _slice$22.array[_slice$22.offset + _index$22] : go$throwRuntimeError("index out of range")), (_slice$23 = a, _index$23 = 2, (_index$23 >= 0 && _index$23 < _slice$23.length) ? _slice$23.array[_slice$23.offset + _index$23] : go$throwRuntimeError("index out of range")), (_slice$24 = a, _index$24 = 3, (_index$24 >= 0 && _index$24 < _slice$24.length) ? _slice$24.array[_slice$24.offset + _index$24] : go$throwRuntimeError("index out of range")), (_slice$25 = a, _index$25 = 4, (_index$25 >= 0 && _index$25 < _slice$25.length) ? _slice$25.array[_slice$25.offset + _index$25] : go$throwRuntimeError("index out of range")), (_slice$26 = a, _index$26 = 5, (_index$26 >= 0 && _index$26 < _slice$26.length) ? _slice$26.array[_slice$26.offset + _index$26] : go$throwRuntimeError("index out of range")), (_slice$27 = a, _index$27 = 6, (_index$27 >= 0 && _index$27 < _slice$27.length) ? _slice$27.array[_slice$27.offset + _index$27] : go$throwRuntimeError("index out of range")), 0, 0), r1 = _tuple$7[0], r2 = _tuple$7[1], lastErr = new Errno(_tuple$7[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 8) {
			_tuple$8 = Syscall9(p.Addr(), (a.length >>> 0), (_slice$28 = a, _index$28 = 0, (_index$28 >= 0 && _index$28 < _slice$28.length) ? _slice$28.array[_slice$28.offset + _index$28] : go$throwRuntimeError("index out of range")), (_slice$29 = a, _index$29 = 1, (_index$29 >= 0 && _index$29 < _slice$29.length) ? _slice$29.array[_slice$29.offset + _index$29] : go$throwRuntimeError("index out of range")), (_slice$30 = a, _index$30 = 2, (_index$30 >= 0 && _index$30 < _slice$30.length) ? _slice$30.array[_slice$30.offset + _index$30] : go$throwRuntimeError("index out of range")), (_slice$31 = a, _index$31 = 3, (_index$31 >= 0 && _index$31 < _slice$31.length) ? _slice$31.array[_slice$31.offset + _index$31] : go$throwRuntimeError("index out of range")), (_slice$32 = a, _index$32 = 4, (_index$32 >= 0 && _index$32 < _slice$32.length) ? _slice$32.array[_slice$32.offset + _index$32] : go$throwRuntimeError("index out of range")), (_slice$33 = a, _index$33 = 5, (_index$33 >= 0 && _index$33 < _slice$33.length) ? _slice$33.array[_slice$33.offset + _index$33] : go$throwRuntimeError("index out of range")), (_slice$34 = a, _index$34 = 6, (_index$34 >= 0 && _index$34 < _slice$34.length) ? _slice$34.array[_slice$34.offset + _index$34] : go$throwRuntimeError("index out of range")), (_slice$35 = a, _index$35 = 7, (_index$35 >= 0 && _index$35 < _slice$35.length) ? _slice$35.array[_slice$35.offset + _index$35] : go$throwRuntimeError("index out of range")), 0), r1 = _tuple$8[0], r2 = _tuple$8[1], lastErr = new Errno(_tuple$8[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 9) {
			_tuple$9 = Syscall9(p.Addr(), (a.length >>> 0), (_slice$36 = a, _index$36 = 0, (_index$36 >= 0 && _index$36 < _slice$36.length) ? _slice$36.array[_slice$36.offset + _index$36] : go$throwRuntimeError("index out of range")), (_slice$37 = a, _index$37 = 1, (_index$37 >= 0 && _index$37 < _slice$37.length) ? _slice$37.array[_slice$37.offset + _index$37] : go$throwRuntimeError("index out of range")), (_slice$38 = a, _index$38 = 2, (_index$38 >= 0 && _index$38 < _slice$38.length) ? _slice$38.array[_slice$38.offset + _index$38] : go$throwRuntimeError("index out of range")), (_slice$39 = a, _index$39 = 3, (_index$39 >= 0 && _index$39 < _slice$39.length) ? _slice$39.array[_slice$39.offset + _index$39] : go$throwRuntimeError("index out of range")), (_slice$40 = a, _index$40 = 4, (_index$40 >= 0 && _index$40 < _slice$40.length) ? _slice$40.array[_slice$40.offset + _index$40] : go$throwRuntimeError("index out of range")), (_slice$41 = a, _index$41 = 5, (_index$41 >= 0 && _index$41 < _slice$41.length) ? _slice$41.array[_slice$41.offset + _index$41] : go$throwRuntimeError("index out of range")), (_slice$42 = a, _index$42 = 6, (_index$42 >= 0 && _index$42 < _slice$42.length) ? _slice$42.array[_slice$42.offset + _index$42] : go$throwRuntimeError("index out of range")), (_slice$43 = a, _index$43 = 7, (_index$43 >= 0 && _index$43 < _slice$43.length) ? _slice$43.array[_slice$43.offset + _index$43] : go$throwRuntimeError("index out of range")), (_slice$44 = a, _index$44 = 8, (_index$44 >= 0 && _index$44 < _slice$44.length) ? _slice$44.array[_slice$44.offset + _index$44] : go$throwRuntimeError("index out of range"))), r1 = _tuple$9[0], r2 = _tuple$9[1], lastErr = new Errno(_tuple$9[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 10) {
			_tuple$10 = Syscall12(p.Addr(), (a.length >>> 0), (_slice$45 = a, _index$45 = 0, (_index$45 >= 0 && _index$45 < _slice$45.length) ? _slice$45.array[_slice$45.offset + _index$45] : go$throwRuntimeError("index out of range")), (_slice$46 = a, _index$46 = 1, (_index$46 >= 0 && _index$46 < _slice$46.length) ? _slice$46.array[_slice$46.offset + _index$46] : go$throwRuntimeError("index out of range")), (_slice$47 = a, _index$47 = 2, (_index$47 >= 0 && _index$47 < _slice$47.length) ? _slice$47.array[_slice$47.offset + _index$47] : go$throwRuntimeError("index out of range")), (_slice$48 = a, _index$48 = 3, (_index$48 >= 0 && _index$48 < _slice$48.length) ? _slice$48.array[_slice$48.offset + _index$48] : go$throwRuntimeError("index out of range")), (_slice$49 = a, _index$49 = 4, (_index$49 >= 0 && _index$49 < _slice$49.length) ? _slice$49.array[_slice$49.offset + _index$49] : go$throwRuntimeError("index out of range")), (_slice$50 = a, _index$50 = 5, (_index$50 >= 0 && _index$50 < _slice$50.length) ? _slice$50.array[_slice$50.offset + _index$50] : go$throwRuntimeError("index out of range")), (_slice$51 = a, _index$51 = 6, (_index$51 >= 0 && _index$51 < _slice$51.length) ? _slice$51.array[_slice$51.offset + _index$51] : go$throwRuntimeError("index out of range")), (_slice$52 = a, _index$52 = 7, (_index$52 >= 0 && _index$52 < _slice$52.length) ? _slice$52.array[_slice$52.offset + _index$52] : go$throwRuntimeError("index out of range")), (_slice$53 = a, _index$53 = 8, (_index$53 >= 0 && _index$53 < _slice$53.length) ? _slice$53.array[_slice$53.offset + _index$53] : go$throwRuntimeError("index out of range")), (_slice$54 = a, _index$54 = 9, (_index$54 >= 0 && _index$54 < _slice$54.length) ? _slice$54.array[_slice$54.offset + _index$54] : go$throwRuntimeError("index out of range")), 0, 0), r1 = _tuple$10[0], r2 = _tuple$10[1], lastErr = new Errno(_tuple$10[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 11) {
			_tuple$11 = Syscall12(p.Addr(), (a.length >>> 0), (_slice$55 = a, _index$55 = 0, (_index$55 >= 0 && _index$55 < _slice$55.length) ? _slice$55.array[_slice$55.offset + _index$55] : go$throwRuntimeError("index out of range")), (_slice$56 = a, _index$56 = 1, (_index$56 >= 0 && _index$56 < _slice$56.length) ? _slice$56.array[_slice$56.offset + _index$56] : go$throwRuntimeError("index out of range")), (_slice$57 = a, _index$57 = 2, (_index$57 >= 0 && _index$57 < _slice$57.length) ? _slice$57.array[_slice$57.offset + _index$57] : go$throwRuntimeError("index out of range")), (_slice$58 = a, _index$58 = 3, (_index$58 >= 0 && _index$58 < _slice$58.length) ? _slice$58.array[_slice$58.offset + _index$58] : go$throwRuntimeError("index out of range")), (_slice$59 = a, _index$59 = 4, (_index$59 >= 0 && _index$59 < _slice$59.length) ? _slice$59.array[_slice$59.offset + _index$59] : go$throwRuntimeError("index out of range")), (_slice$60 = a, _index$60 = 5, (_index$60 >= 0 && _index$60 < _slice$60.length) ? _slice$60.array[_slice$60.offset + _index$60] : go$throwRuntimeError("index out of range")), (_slice$61 = a, _index$61 = 6, (_index$61 >= 0 && _index$61 < _slice$61.length) ? _slice$61.array[_slice$61.offset + _index$61] : go$throwRuntimeError("index out of range")), (_slice$62 = a, _index$62 = 7, (_index$62 >= 0 && _index$62 < _slice$62.length) ? _slice$62.array[_slice$62.offset + _index$62] : go$throwRuntimeError("index out of range")), (_slice$63 = a, _index$63 = 8, (_index$63 >= 0 && _index$63 < _slice$63.length) ? _slice$63.array[_slice$63.offset + _index$63] : go$throwRuntimeError("index out of range")), (_slice$64 = a, _index$64 = 9, (_index$64 >= 0 && _index$64 < _slice$64.length) ? _slice$64.array[_slice$64.offset + _index$64] : go$throwRuntimeError("index out of range")), (_slice$65 = a, _index$65 = 10, (_index$65 >= 0 && _index$65 < _slice$65.length) ? _slice$65.array[_slice$65.offset + _index$65] : go$throwRuntimeError("index out of range")), 0), r1 = _tuple$11[0], r2 = _tuple$11[1], lastErr = new Errno(_tuple$11[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 12) {
			_tuple$12 = Syscall12(p.Addr(), (a.length >>> 0), (_slice$66 = a, _index$66 = 0, (_index$66 >= 0 && _index$66 < _slice$66.length) ? _slice$66.array[_slice$66.offset + _index$66] : go$throwRuntimeError("index out of range")), (_slice$67 = a, _index$67 = 1, (_index$67 >= 0 && _index$67 < _slice$67.length) ? _slice$67.array[_slice$67.offset + _index$67] : go$throwRuntimeError("index out of range")), (_slice$68 = a, _index$68 = 2, (_index$68 >= 0 && _index$68 < _slice$68.length) ? _slice$68.array[_slice$68.offset + _index$68] : go$throwRuntimeError("index out of range")), (_slice$69 = a, _index$69 = 3, (_index$69 >= 0 && _index$69 < _slice$69.length) ? _slice$69.array[_slice$69.offset + _index$69] : go$throwRuntimeError("index out of range")), (_slice$70 = a, _index$70 = 4, (_index$70 >= 0 && _index$70 < _slice$70.length) ? _slice$70.array[_slice$70.offset + _index$70] : go$throwRuntimeError("index out of range")), (_slice$71 = a, _index$71 = 5, (_index$71 >= 0 && _index$71 < _slice$71.length) ? _slice$71.array[_slice$71.offset + _index$71] : go$throwRuntimeError("index out of range")), (_slice$72 = a, _index$72 = 6, (_index$72 >= 0 && _index$72 < _slice$72.length) ? _slice$72.array[_slice$72.offset + _index$72] : go$throwRuntimeError("index out of range")), (_slice$73 = a, _index$73 = 7, (_index$73 >= 0 && _index$73 < _slice$73.length) ? _slice$73.array[_slice$73.offset + _index$73] : go$throwRuntimeError("index out of range")), (_slice$74 = a, _index$74 = 8, (_index$74 >= 0 && _index$74 < _slice$74.length) ? _slice$74.array[_slice$74.offset + _index$74] : go$throwRuntimeError("index out of range")), (_slice$75 = a, _index$75 = 9, (_index$75 >= 0 && _index$75 < _slice$75.length) ? _slice$75.array[_slice$75.offset + _index$75] : go$throwRuntimeError("index out of range")), (_slice$76 = a, _index$76 = 10, (_index$76 >= 0 && _index$76 < _slice$76.length) ? _slice$76.array[_slice$76.offset + _index$76] : go$throwRuntimeError("index out of range")), (_slice$77 = a, _index$77 = 11, (_index$77 >= 0 && _index$77 < _slice$77.length) ? _slice$77.array[_slice$77.offset + _index$77] : go$throwRuntimeError("index out of range"))), r1 = _tuple$12[0], r2 = _tuple$12[1], lastErr = new Errno(_tuple$12[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 13) {
			_tuple$13 = Syscall15(p.Addr(), (a.length >>> 0), (_slice$78 = a, _index$78 = 0, (_index$78 >= 0 && _index$78 < _slice$78.length) ? _slice$78.array[_slice$78.offset + _index$78] : go$throwRuntimeError("index out of range")), (_slice$79 = a, _index$79 = 1, (_index$79 >= 0 && _index$79 < _slice$79.length) ? _slice$79.array[_slice$79.offset + _index$79] : go$throwRuntimeError("index out of range")), (_slice$80 = a, _index$80 = 2, (_index$80 >= 0 && _index$80 < _slice$80.length) ? _slice$80.array[_slice$80.offset + _index$80] : go$throwRuntimeError("index out of range")), (_slice$81 = a, _index$81 = 3, (_index$81 >= 0 && _index$81 < _slice$81.length) ? _slice$81.array[_slice$81.offset + _index$81] : go$throwRuntimeError("index out of range")), (_slice$82 = a, _index$82 = 4, (_index$82 >= 0 && _index$82 < _slice$82.length) ? _slice$82.array[_slice$82.offset + _index$82] : go$throwRuntimeError("index out of range")), (_slice$83 = a, _index$83 = 5, (_index$83 >= 0 && _index$83 < _slice$83.length) ? _slice$83.array[_slice$83.offset + _index$83] : go$throwRuntimeError("index out of range")), (_slice$84 = a, _index$84 = 6, (_index$84 >= 0 && _index$84 < _slice$84.length) ? _slice$84.array[_slice$84.offset + _index$84] : go$throwRuntimeError("index out of range")), (_slice$85 = a, _index$85 = 7, (_index$85 >= 0 && _index$85 < _slice$85.length) ? _slice$85.array[_slice$85.offset + _index$85] : go$throwRuntimeError("index out of range")), (_slice$86 = a, _index$86 = 8, (_index$86 >= 0 && _index$86 < _slice$86.length) ? _slice$86.array[_slice$86.offset + _index$86] : go$throwRuntimeError("index out of range")), (_slice$87 = a, _index$87 = 9, (_index$87 >= 0 && _index$87 < _slice$87.length) ? _slice$87.array[_slice$87.offset + _index$87] : go$throwRuntimeError("index out of range")), (_slice$88 = a, _index$88 = 10, (_index$88 >= 0 && _index$88 < _slice$88.length) ? _slice$88.array[_slice$88.offset + _index$88] : go$throwRuntimeError("index out of range")), (_slice$89 = a, _index$89 = 11, (_index$89 >= 0 && _index$89 < _slice$89.length) ? _slice$89.array[_slice$89.offset + _index$89] : go$throwRuntimeError("index out of range")), (_slice$90 = a, _index$90 = 12, (_index$90 >= 0 && _index$90 < _slice$90.length) ? _slice$90.array[_slice$90.offset + _index$90] : go$throwRuntimeError("index out of range")), 0, 0), r1 = _tuple$13[0], r2 = _tuple$13[1], lastErr = new Errno(_tuple$13[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 14) {
			_tuple$14 = Syscall15(p.Addr(), (a.length >>> 0), (_slice$91 = a, _index$91 = 0, (_index$91 >= 0 && _index$91 < _slice$91.length) ? _slice$91.array[_slice$91.offset + _index$91] : go$throwRuntimeError("index out of range")), (_slice$92 = a, _index$92 = 1, (_index$92 >= 0 && _index$92 < _slice$92.length) ? _slice$92.array[_slice$92.offset + _index$92] : go$throwRuntimeError("index out of range")), (_slice$93 = a, _index$93 = 2, (_index$93 >= 0 && _index$93 < _slice$93.length) ? _slice$93.array[_slice$93.offset + _index$93] : go$throwRuntimeError("index out of range")), (_slice$94 = a, _index$94 = 3, (_index$94 >= 0 && _index$94 < _slice$94.length) ? _slice$94.array[_slice$94.offset + _index$94] : go$throwRuntimeError("index out of range")), (_slice$95 = a, _index$95 = 4, (_index$95 >= 0 && _index$95 < _slice$95.length) ? _slice$95.array[_slice$95.offset + _index$95] : go$throwRuntimeError("index out of range")), (_slice$96 = a, _index$96 = 5, (_index$96 >= 0 && _index$96 < _slice$96.length) ? _slice$96.array[_slice$96.offset + _index$96] : go$throwRuntimeError("index out of range")), (_slice$97 = a, _index$97 = 6, (_index$97 >= 0 && _index$97 < _slice$97.length) ? _slice$97.array[_slice$97.offset + _index$97] : go$throwRuntimeError("index out of range")), (_slice$98 = a, _index$98 = 7, (_index$98 >= 0 && _index$98 < _slice$98.length) ? _slice$98.array[_slice$98.offset + _index$98] : go$throwRuntimeError("index out of range")), (_slice$99 = a, _index$99 = 8, (_index$99 >= 0 && _index$99 < _slice$99.length) ? _slice$99.array[_slice$99.offset + _index$99] : go$throwRuntimeError("index out of range")), (_slice$100 = a, _index$100 = 9, (_index$100 >= 0 && _index$100 < _slice$100.length) ? _slice$100.array[_slice$100.offset + _index$100] : go$throwRuntimeError("index out of range")), (_slice$101 = a, _index$101 = 10, (_index$101 >= 0 && _index$101 < _slice$101.length) ? _slice$101.array[_slice$101.offset + _index$101] : go$throwRuntimeError("index out of range")), (_slice$102 = a, _index$102 = 11, (_index$102 >= 0 && _index$102 < _slice$102.length) ? _slice$102.array[_slice$102.offset + _index$102] : go$throwRuntimeError("index out of range")), (_slice$103 = a, _index$103 = 12, (_index$103 >= 0 && _index$103 < _slice$103.length) ? _slice$103.array[_slice$103.offset + _index$103] : go$throwRuntimeError("index out of range")), (_slice$104 = a, _index$104 = 13, (_index$104 >= 0 && _index$104 < _slice$104.length) ? _slice$104.array[_slice$104.offset + _index$104] : go$throwRuntimeError("index out of range")), 0), r1 = _tuple$14[0], r2 = _tuple$14[1], lastErr = new Errno(_tuple$14[2]);
			return [r1, r2, lastErr];
		} else if (_ref === 15) {
			_tuple$15 = Syscall15(p.Addr(), (a.length >>> 0), (_slice$105 = a, _index$105 = 0, (_index$105 >= 0 && _index$105 < _slice$105.length) ? _slice$105.array[_slice$105.offset + _index$105] : go$throwRuntimeError("index out of range")), (_slice$106 = a, _index$106 = 1, (_index$106 >= 0 && _index$106 < _slice$106.length) ? _slice$106.array[_slice$106.offset + _index$106] : go$throwRuntimeError("index out of range")), (_slice$107 = a, _index$107 = 2, (_index$107 >= 0 && _index$107 < _slice$107.length) ? _slice$107.array[_slice$107.offset + _index$107] : go$throwRuntimeError("index out of range")), (_slice$108 = a, _index$108 = 3, (_index$108 >= 0 && _index$108 < _slice$108.length) ? _slice$108.array[_slice$108.offset + _index$108] : go$throwRuntimeError("index out of range")), (_slice$109 = a, _index$109 = 4, (_index$109 >= 0 && _index$109 < _slice$109.length) ? _slice$109.array[_slice$109.offset + _index$109] : go$throwRuntimeError("index out of range")), (_slice$110 = a, _index$110 = 5, (_index$110 >= 0 && _index$110 < _slice$110.length) ? _slice$110.array[_slice$110.offset + _index$110] : go$throwRuntimeError("index out of range")), (_slice$111 = a, _index$111 = 6, (_index$111 >= 0 && _index$111 < _slice$111.length) ? _slice$111.array[_slice$111.offset + _index$111] : go$throwRuntimeError("index out of range")), (_slice$112 = a, _index$112 = 7, (_index$112 >= 0 && _index$112 < _slice$112.length) ? _slice$112.array[_slice$112.offset + _index$112] : go$throwRuntimeError("index out of range")), (_slice$113 = a, _index$113 = 8, (_index$113 >= 0 && _index$113 < _slice$113.length) ? _slice$113.array[_slice$113.offset + _index$113] : go$throwRuntimeError("index out of range")), (_slice$114 = a, _index$114 = 9, (_index$114 >= 0 && _index$114 < _slice$114.length) ? _slice$114.array[_slice$114.offset + _index$114] : go$throwRuntimeError("index out of range")), (_slice$115 = a, _index$115 = 10, (_index$115 >= 0 && _index$115 < _slice$115.length) ? _slice$115.array[_slice$115.offset + _index$115] : go$throwRuntimeError("index out of range")), (_slice$116 = a, _index$116 = 11, (_index$116 >= 0 && _index$116 < _slice$116.length) ? _slice$116.array[_slice$116.offset + _index$116] : go$throwRuntimeError("index out of range")), (_slice$117 = a, _index$117 = 12, (_index$117 >= 0 && _index$117 < _slice$117.length) ? _slice$117.array[_slice$117.offset + _index$117] : go$throwRuntimeError("index out of range")), (_slice$118 = a, _index$118 = 13, (_index$118 >= 0 && _index$118 < _slice$118.length) ? _slice$118.array[_slice$118.offset + _index$118] : go$throwRuntimeError("index out of range")), (_slice$119 = a, _index$119 = 14, (_index$119 >= 0 && _index$119 < _slice$119.length) ? _slice$119.array[_slice$119.offset + _index$119] : go$throwRuntimeError("index out of range"))), r1 = _tuple$15[0], r2 = _tuple$15[1], lastErr = new Errno(_tuple$15[2]);
			return [r1, r2, lastErr];
		} else {
			throw go$panic(new Go$String("Call " + p.Name + " with too many arguments " + itoa(a.length) + "."));
		}
		return [r1, r2, lastErr];
	};
	Proc.prototype.Call = function(a) { return this.go$val.Call(a); };
	LazyDLL.Ptr.prototype.Load = function() {
		var d, v, _tuple, dll, e, v$1, _array, _struct, _view;
		var go$deferred = [];
		try {
			d = this;
			if (atomic.LoadPointer(new (go$ptrType((go$ptrType(DLL))))(function() { return d.dll; }, function(v) { d.dll = v; })) === 0) {
				d.mu.Lock();
				go$deferred.push({ recv: d.mu, method: "Unlock", args: [] });
				if (d.dll === (go$ptrType(DLL)).nil) {
					_tuple = LoadDLL(d.Name), dll = _tuple[0], e = _tuple[1];
					if (!(go$interfaceIsEqual(e, null))) {
						return e;
					}
					_array = new Uint8Array(12);
					atomic.StorePointer(new (go$ptrType((go$ptrType(DLL))))(function() { return d.dll; }, function(v$1) { d.dll = v$1; }), _array);
					_struct = dll, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Handle = _view.getUintptr(8, true);
				}
			}
			return null;
		} catch(go$err) {
			go$pushErr(go$err);
			return null;
		} finally {
			go$callDeferred(go$deferred);
		}
	};
	LazyDLL.prototype.Load = function() { return this.go$val.Load(); };
	LazyDLL.Ptr.prototype.mustLoad = function() {
		var d, e;
		d = this;
		e = d.Load();
		if (!(go$interfaceIsEqual(e, null))) {
			throw go$panic(e);
		}
	};
	LazyDLL.prototype.mustLoad = function() { return this.go$val.mustLoad(); };
	LazyDLL.Ptr.prototype.Handle = function() {
		var d;
		d = this;
		d.mustLoad();
		return (d.dll.Handle >>> 0);
	};
	LazyDLL.prototype.Handle = function() { return this.go$val.Handle(); };
	LazyDLL.Ptr.prototype.NewProc = function(name) {
		var d;
		d = this;
		return new LazyProc.Ptr(new sync.Mutex.Ptr(), name, d, (go$ptrType(Proc)).nil);
	};
	LazyDLL.prototype.NewProc = function(name) { return this.go$val.NewProc(name); };
	var NewLazyDLL = go$pkg.NewLazyDLL = function(name) {
		return new LazyDLL.Ptr(new sync.Mutex.Ptr(), (go$ptrType(DLL)).nil, name);
	};
	LazyProc.Ptr.prototype.Find = function() {
		var p, v, e, _tuple, proc, v$1, _array, _struct, _view;
		var go$deferred = [];
		try {
			p = this;
			if (atomic.LoadPointer(new (go$ptrType((go$ptrType(Proc))))(function() { return p.proc; }, function(v) { p.proc = v; })) === 0) {
				p.mu.Lock();
				go$deferred.push({ recv: p.mu, method: "Unlock", args: [] });
				if (p.proc === (go$ptrType(Proc)).nil) {
					e = p.l.Load();
					if (!(go$interfaceIsEqual(e, null))) {
						return e;
					}
					_tuple = p.l.dll.FindProc(p.Name), proc = _tuple[0], e = _tuple[1];
					if (!(go$interfaceIsEqual(e, null))) {
						return e;
					}
					_array = new Uint8Array(20);
					atomic.StorePointer(new (go$ptrType((go$ptrType(Proc))))(function() { return p.proc; }, function(v$1) { p.proc = v$1; }), _array);
					_struct = proc, _view = new DataView(_array.buffer, _array.byteOffset), _struct.addr = _view.getUintptr(16, true);
				}
			}
			return null;
		} catch(go$err) {
			go$pushErr(go$err);
			return null;
		} finally {
			go$callDeferred(go$deferred);
		}
	};
	LazyProc.prototype.Find = function() { return this.go$val.Find(); };
	LazyProc.Ptr.prototype.mustFind = function() {
		var p, e;
		p = this;
		e = p.Find();
		if (!(go$interfaceIsEqual(e, null))) {
			throw go$panic(e);
		}
	};
	LazyProc.prototype.mustFind = function() { return this.go$val.mustFind(); };
	LazyProc.Ptr.prototype.Addr = function() {
		var p;
		p = this;
		p.mustFind();
		return p.proc.Addr();
	};
	LazyProc.prototype.Addr = function() { return this.go$val.Addr(); };
	LazyProc.Ptr.prototype.Call = function(a) {
		var r1, r2, lastErr, p, _tuple;
		r1 = 0;
		r2 = 0;
		lastErr = null;
		p = this;
		p.mustFind();
		_tuple = p.proc.Call(a), r1 = _tuple[0], r2 = _tuple[1], lastErr = _tuple[2];
		return [r1, r2, lastErr];
	};
	LazyProc.prototype.Call = function(a) { return this.go$val.Call(a); };
	var Getenv = go$pkg.Getenv = function(key) {
		var value, found, _tuple, keyp, err, _tuple$1, b, _tuple$2, v, _slice, _index, _slice$1, _index$1, n, e, _tuple$3, _tuple$4, v$1, _slice$2, _index$2, _slice$3, _index$3, _tuple$5;
		value = "";
		found = false;
		_tuple = UTF16PtrFromString(key), keyp = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			_tuple$1 = ["", false], value = _tuple$1[0], found = _tuple$1[1];
			return [value, found];
		}
		b = (go$sliceType(Go$Uint16)).make(100, 0, function() { return 0; });
		_tuple$2 = GetEnvironmentVariable(keyp, new (go$ptrType(Go$Uint16))(function() { return (_slice = b, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")); }, function(v) { _slice$1 = b, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = v) : go$throwRuntimeError("index out of range"); }), (b.length >>> 0)), n = _tuple$2[0], e = _tuple$2[1];
		if ((n === 0) && go$interfaceIsEqual(e, new Errno(203))) {
			_tuple$3 = ["", false], value = _tuple$3[0], found = _tuple$3[1];
			return [value, found];
		}
		if (n > (b.length >>> 0)) {
			b = (go$sliceType(Go$Uint16)).make(n, 0, function() { return 0; });
			_tuple$4 = GetEnvironmentVariable(keyp, new (go$ptrType(Go$Uint16))(function() { return (_slice$2 = b, _index$2 = 0, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")); }, function(v$1) { _slice$3 = b, _index$3 = 0, (_index$3 >= 0 && _index$3 < _slice$3.length) ? (_slice$3.array[_slice$3.offset + _index$3] = v$1) : go$throwRuntimeError("index out of range"); }), (b.length >>> 0)), n = _tuple$4[0], e = _tuple$4[1];
			if (n > (b.length >>> 0)) {
				n = 0;
			}
		}
		_tuple$5 = [go$runesToString(utf16.Decode(go$subslice(b, 0, n))), true], value = _tuple$5[0], found = _tuple$5[1];
		return [value, found];
	};
	var Setenv = go$pkg.Setenv = function(key, value) {
		var _tuple, v, err, _tuple$1, keyp, e;
		_tuple = UTF16PtrFromString(value), v = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			return err;
		}
		_tuple$1 = UTF16PtrFromString(key), keyp = _tuple$1[0], err = _tuple$1[1];
		if (!(go$interfaceIsEqual(err, null))) {
			return err;
		}
		e = SetEnvironmentVariable(keyp, v);
		if (!(go$interfaceIsEqual(e, null))) {
			return e;
		}
		return null;
	};
	var Clearenv = go$pkg.Clearenv = function() {
		var _ref, _i, _slice, _index, s, j;
		_ref = Environ();
		_i = 0;
		while (_i < _ref.length) {
			s = (_slice = _ref, _index = _i, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range"));
			j = 1;
			while (j < s.length) {
				if (s.charCodeAt(j) === 61) {
					Setenv(s.substring(0, j), "");
					break;
				}
				j = j + 1 >> 0;
			}
			_i++;
		}
	};
	var Environ = go$pkg.Environ = function() {
		var _tuple, s, e, r, _tuple$1, from, i, p;
		var go$deferred = [];
		try {
			_tuple = GetEnvironmentStrings(), s = _tuple[0], e = _tuple[1];
			if (!(go$interfaceIsEqual(e, null))) {
				return (go$sliceType(Go$String)).nil;
			}
			go$deferred.push({ fun: FreeEnvironmentStrings, args: [s] });
			r = (go$sliceType(Go$String)).make(0, 50, function() { return ""; });
			_tuple$1 = [0, 0, s], from = _tuple$1[0], i = _tuple$1[1], p = _tuple$1[2];
			while (true) {
				if (p[i] === 0) {
					if (i <= from) {
						break;
					}
					r = go$append(r, go$runesToString(utf16.Decode(go$subslice(new (go$sliceType(Go$Uint16))(p), from, i))));
					from = i + 1 >> 0;
				}
				i = i + 1 >> 0;
			}
			return r;
		} catch(go$err) {
			go$pushErr(go$err);
			return (go$sliceType(Go$String)).nil;
		} finally {
			go$callDeferred(go$deferred);
		}
	};
	var EscapeArg = go$pkg.EscapeArg = function(s) {
		var n, hasSpace, i, _ref, qs, j, _slice, _index, slashes, i$1, _ref$1, _slice$1, _index$1, _slice$2, _index$2, _slice$3, _index$3, _slice$4, _index$4, _slice$5, _index$5, _slice$6, _index$6, _slice$7, _index$7;
		if (s.length === 0) {
			return "\"\"";
		}
		n = s.length;
		hasSpace = false;
		i = 0;
		while (i < s.length) {
			_ref = s.charCodeAt(i);
			if (_ref === 34 || _ref === 92) {
				n = n + 1 >> 0;
			} else if (_ref === 32 || _ref === 9) {
				hasSpace = true;
			}
			i = i + 1 >> 0;
		}
		if (hasSpace) {
			n = n + 2 >> 0;
		}
		if (n === s.length) {
			return s;
		}
		qs = (go$sliceType(Go$Uint8)).make(n, 0, function() { return 0; });
		j = 0;
		if (hasSpace) {
			_slice = qs, _index = j, (_index >= 0 && _index < _slice.length) ? (_slice.array[_slice.offset + _index] = 34) : go$throwRuntimeError("index out of range");
			j = j + 1 >> 0;
		}
		slashes = 0;
		i$1 = 0;
		while (i$1 < s.length) {
			_ref$1 = s.charCodeAt(i$1);
			if (_ref$1 === 92) {
				slashes = slashes + 1 >> 0;
				_slice$1 = qs, _index$1 = j, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = s.charCodeAt(i$1)) : go$throwRuntimeError("index out of range");
			} else if (_ref$1 === 34) {
				while (slashes > 0) {
					_slice$2 = qs, _index$2 = j, (_index$2 >= 0 && _index$2 < _slice$2.length) ? (_slice$2.array[_slice$2.offset + _index$2] = 92) : go$throwRuntimeError("index out of range");
					j = j + 1 >> 0;
					slashes = slashes - 1 >> 0;
				}
				_slice$3 = qs, _index$3 = j, (_index$3 >= 0 && _index$3 < _slice$3.length) ? (_slice$3.array[_slice$3.offset + _index$3] = 92) : go$throwRuntimeError("index out of range");
				j = j + 1 >> 0;
				_slice$4 = qs, _index$4 = j, (_index$4 >= 0 && _index$4 < _slice$4.length) ? (_slice$4.array[_slice$4.offset + _index$4] = s.charCodeAt(i$1)) : go$throwRuntimeError("index out of range");
			} else {
				slashes = 0;
				_slice$5 = qs, _index$5 = j, (_index$5 >= 0 && _index$5 < _slice$5.length) ? (_slice$5.array[_slice$5.offset + _index$5] = s.charCodeAt(i$1)) : go$throwRuntimeError("index out of range");
			}
			j = j + 1 >> 0;
			i$1 = i$1 + 1 >> 0;
		}
		if (hasSpace) {
			while (slashes > 0) {
				_slice$6 = qs, _index$6 = j, (_index$6 >= 0 && _index$6 < _slice$6.length) ? (_slice$6.array[_slice$6.offset + _index$6] = 92) : go$throwRuntimeError("index out of range");
				j = j + 1 >> 0;
				slashes = slashes - 1 >> 0;
			}
			_slice$7 = qs, _index$7 = j, (_index$7 >= 0 && _index$7 < _slice$7.length) ? (_slice$7.array[_slice$7.offset + _index$7] = 34) : go$throwRuntimeError("index out of range");
			j = j + 1 >> 0;
		}
		return go$bytesToString(go$subslice(qs, 0, j));
	};
	var makeCmdLine = function(args) {
		var s, _ref, _i, _slice, _index, v;
		s = "";
		_ref = args;
		_i = 0;
		while (_i < _ref.length) {
			v = (_slice = _ref, _index = _i, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range"));
			if (!(s === "")) {
				s = s + " ";
			}
			s = s + (EscapeArg(v));
			_i++;
		}
		return s;
	};
	var createEnvBlock = function(envv) {
		var v, _slice, _index, _slice$1, _index$1, length, _ref, _i, _slice$2, _index$2, s, b, i, _ref$1, _i$1, _slice$3, _index$3, s$1, l, v$1, _slice$4, _index$4, _slice$5, _index$5;
		if (envv.length === 0) {
			return new (go$ptrType(Go$Uint16))(function() { return (_slice = utf16.Encode(new (go$sliceType(Go$Int32))(go$stringToRunes("\x00\x00"))), _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")); }, function(v) { _slice$1 = utf16.Encode(new (go$sliceType(Go$Int32))(go$stringToRunes("\x00\x00"))), _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = v) : go$throwRuntimeError("index out of range"); });
		}
		length = 0;
		_ref = envv;
		_i = 0;
		while (_i < _ref.length) {
			s = (_slice$2 = _ref, _index$2 = _i, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range"));
			length = length + ((s.length + 1 >> 0)) >> 0;
			_i++;
		}
		length = length + 1 >> 0;
		b = (go$sliceType(Go$Uint8)).make(length, 0, function() { return 0; });
		i = 0;
		_ref$1 = envv;
		_i$1 = 0;
		while (_i$1 < _ref$1.length) {
			s$1 = (_slice$3 = _ref$1, _index$3 = _i$1, (_index$3 >= 0 && _index$3 < _slice$3.length) ? _slice$3.array[_slice$3.offset + _index$3] : go$throwRuntimeError("index out of range"));
			l = s$1.length;
			go$copySlice(go$subslice(b, i, (i + l >> 0)), new (go$sliceType(Go$Uint8))(go$stringToBytes(s$1)));
			go$copySlice(go$subslice(b, i + l >> 0, ((i + l >> 0) + 1 >> 0)), new (go$sliceType(Go$Uint8))([0]));
			i = (i + l >> 0) + 1 >> 0;
			_i$1++;
		}
		go$copySlice(go$subslice(b, i, (i + 1 >> 0)), new (go$sliceType(Go$Uint8))([0]));
		return new (go$ptrType(Go$Uint16))(function() { return (_slice$4 = utf16.Encode(new (go$sliceType(Go$Int32))(go$stringToRunes(go$bytesToString(b)))), _index$4 = 0, (_index$4 >= 0 && _index$4 < _slice$4.length) ? _slice$4.array[_slice$4.offset + _index$4] : go$throwRuntimeError("index out of range")); }, function(v$1) { _slice$5 = utf16.Encode(new (go$sliceType(Go$Int32))(go$stringToRunes(go$bytesToString(b)))), _index$5 = 0, (_index$5 >= 0 && _index$5 < _slice$5.length) ? (_slice$5.array[_slice$5.offset + _index$5] = v$1) : go$throwRuntimeError("index out of range"); });
	};
	var CloseOnExec = go$pkg.CloseOnExec = function(fd) {
		SetHandleInformation(fd, 1, 0);
	};
	var SetNonblock = go$pkg.SetNonblock = function(fd, nonblocking) {
		var err;
		err = null;
		err = null;
		return err;
	};
	var getFullPath = function(name) {
		var path, err, _tuple, p, _tuple$1, buf, _tuple$2, v, _slice, _index, _slice$1, _index$1, n, _tuple$3, _tuple$4, v$1, _slice$2, _index$2, _slice$3, _index$3, _tuple$5, _tuple$6, _tuple$7;
		path = "";
		err = null;
		_tuple = UTF16PtrFromString(name), p = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			_tuple$1 = ["", err], path = _tuple$1[0], err = _tuple$1[1];
			return [path, err];
		}
		buf = (go$sliceType(Go$Uint16)).make(100, 0, function() { return 0; });
		_tuple$2 = GetFullPathName(p, (buf.length >>> 0), new (go$ptrType(Go$Uint16))(function() { return (_slice = buf, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")); }, function(v) { _slice$1 = buf, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = v) : go$throwRuntimeError("index out of range"); }), (go$ptrType((go$ptrType(Go$Uint16)))).nil), n = _tuple$2[0], err = _tuple$2[1];
		if (!(go$interfaceIsEqual(err, null))) {
			_tuple$3 = ["", err], path = _tuple$3[0], err = _tuple$3[1];
			return [path, err];
		}
		if (n > (buf.length >>> 0)) {
			buf = (go$sliceType(Go$Uint16)).make(n, 0, function() { return 0; });
			_tuple$4 = GetFullPathName(p, (buf.length >>> 0), new (go$ptrType(Go$Uint16))(function() { return (_slice$2 = buf, _index$2 = 0, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")); }, function(v$1) { _slice$3 = buf, _index$3 = 0, (_index$3 >= 0 && _index$3 < _slice$3.length) ? (_slice$3.array[_slice$3.offset + _index$3] = v$1) : go$throwRuntimeError("index out of range"); }), (go$ptrType((go$ptrType(Go$Uint16)))).nil), n = _tuple$4[0], err = _tuple$4[1];
			if (!(go$interfaceIsEqual(err, null))) {
				_tuple$5 = ["", err], path = _tuple$5[0], err = _tuple$5[1];
				return [path, err];
			}
			if (n > (buf.length >>> 0)) {
				_tuple$6 = ["", new Errno(536870951)], path = _tuple$6[0], err = _tuple$6[1];
				return [path, err];
			}
		}
		_tuple$7 = [UTF16ToString(go$subslice(buf, 0, n)), null], path = _tuple$7[0], err = _tuple$7[1];
		return [path, err];
	};
	var isSlash = function(c) {
		return (c === 92) || (c === 47);
	};
	var normalizeDir = function(dir) {
		var name, err, _tuple, ndir, _tuple$1, _tuple$2, _tuple$3;
		name = "";
		err = null;
		_tuple = getFullPath(dir), ndir = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			_tuple$1 = ["", err], name = _tuple$1[0], err = _tuple$1[1];
			return [name, err];
		}
		if (ndir.length > 2 && isSlash(ndir.charCodeAt(0)) && isSlash(ndir.charCodeAt(1))) {
			_tuple$2 = ["", new Errno(536870951)], name = _tuple$2[0], err = _tuple$2[1];
			return [name, err];
		}
		_tuple$3 = [ndir, null], name = _tuple$3[0], err = _tuple$3[1];
		return [name, err];
	};
	var volToUpper = function(ch) {
		if (97 <= ch && ch <= 122) {
			ch = ch + -32 >> 0;
		}
		return ch;
	};
	var joinExeDirAndFName = function(dir, p) {
		var name, err, _tuple, _tuple$1, _tuple$2, _tuple$3, _tuple$4, d, err$1, _tuple$5, _tuple$6, _tuple$7, _tuple$8, d$1, err$2, _tuple$9, _tuple$10, _tuple$11, _tuple$12;
		name = "";
		err = null;
		if (p.length === 0) {
			_tuple = ["", new Errno(536870951)], name = _tuple[0], err = _tuple[1];
			return [name, err];
		}
		if (p.length > 2 && isSlash(p.charCodeAt(0)) && isSlash(p.charCodeAt(1))) {
			_tuple$1 = [p, null], name = _tuple$1[0], err = _tuple$1[1];
			return [name, err];
		}
		if (p.length > 1 && (p.charCodeAt(1) === 58)) {
			if (p.length === 2) {
				_tuple$2 = ["", new Errno(536870951)], name = _tuple$2[0], err = _tuple$2[1];
				return [name, err];
			}
			if (isSlash(p.charCodeAt(2))) {
				_tuple$3 = [p, null], name = _tuple$3[0], err = _tuple$3[1];
				return [name, err];
			} else {
				_tuple$4 = normalizeDir(dir), d = _tuple$4[0], err$1 = _tuple$4[1];
				if (!(go$interfaceIsEqual(err$1, null))) {
					_tuple$5 = ["", err$1], name = _tuple$5[0], err = _tuple$5[1];
					return [name, err];
				}
				if (volToUpper((p.charCodeAt(0) >> 0)) === volToUpper((d.charCodeAt(0) >> 0))) {
					_tuple$6 = getFullPath(d + "\\" + p.substring(2)), name = _tuple$6[0], err = _tuple$6[1];
					return [name, err];
				} else {
					_tuple$7 = getFullPath(p), name = _tuple$7[0], err = _tuple$7[1];
					return [name, err];
				}
			}
		} else {
			_tuple$8 = normalizeDir(dir), d$1 = _tuple$8[0], err$2 = _tuple$8[1];
			if (!(go$interfaceIsEqual(err$2, null))) {
				_tuple$9 = ["", err$2], name = _tuple$9[0], err = _tuple$9[1];
				return [name, err];
			}
			if (isSlash(p.charCodeAt(0))) {
				_tuple$10 = getFullPath(d$1.substring(0, 2) + p), name = _tuple$10[0], err = _tuple$10[1];
				return [name, err];
			} else {
				_tuple$11 = getFullPath(d$1 + "\\" + p), name = _tuple$11[0], err = _tuple$11[1];
				return [name, err];
			}
		}
		_tuple$12 = ["", new Errno(536870951)], name = _tuple$12[0], err = _tuple$12[1];
		return [name, err];
	};
	var StartProcess = go$pkg.StartProcess = function(argv0, argv, attr) {
		var pid, handle, err, _tuple, sys, _tuple$1, err$1, _tuple$2, _tuple$3, _tuple$4, argv0p, _tuple$5, cmdline, argvp, _tuple$6, _tuple$7, dirp, _tuple$8, _tuple$9, _tuple$10, p, fd, _ref, _i, i, _slice, _index, _slice$1, _index$1, v, _slice$2, _index$2, _slice$3, _index$3, err$2, _tuple$11, _slice$4, _index$4, si, _slice$5, _index$5, _slice$6, _index$6, _slice$7, _index$7, pi, flags, _tuple$12, _tuple$13;
		pid = 0;
		handle = 0;
		err = null;
		var go$deferred = [];
		try {
			if (argv0.length === 0) {
				_tuple = [0, 0, new Errno(536871042)], pid = _tuple[0], handle = _tuple[1], err = _tuple[2];
				return [pid, handle, err];
			}
			if (attr === (go$ptrType(ProcAttr)).nil) {
				attr = zeroProcAttr;
			}
			sys = attr.Sys;
			if (sys === (go$ptrType(SysProcAttr)).nil) {
				sys = zeroSysProcAttr;
			}
			if (attr.Files.length > 3) {
				_tuple$1 = [0, 0, new Errno(536871042)], pid = _tuple$1[0], handle = _tuple$1[1], err = _tuple$1[2];
				return [pid, handle, err];
			}
			if (!((attr.Dir.length === 0))) {
				err$1 = null;
				_tuple$2 = joinExeDirAndFName(attr.Dir, argv0), argv0 = _tuple$2[0], err$1 = _tuple$2[1];
				if (!(go$interfaceIsEqual(err$1, null))) {
					_tuple$3 = [0, 0, err$1], pid = _tuple$3[0], handle = _tuple$3[1], err = _tuple$3[2];
					return [pid, handle, err];
				}
			}
			_tuple$4 = UTF16PtrFromString(argv0), argv0p = _tuple$4[0], err = _tuple$4[1];
			if (!(go$interfaceIsEqual(err, null))) {
				_tuple$5 = [0, 0, err], pid = _tuple$5[0], handle = _tuple$5[1], err = _tuple$5[2];
				return [pid, handle, err];
			}
			cmdline = "";
			if (!(sys.CmdLine === "")) {
				cmdline = sys.CmdLine;
			} else {
				cmdline = makeCmdLine(argv);
			}
			argvp = (go$ptrType(Go$Uint16)).nil;
			if (!((cmdline.length === 0))) {
				_tuple$6 = UTF16PtrFromString(cmdline), argvp = _tuple$6[0], err = _tuple$6[1];
				if (!(go$interfaceIsEqual(err, null))) {
					_tuple$7 = [0, 0, err], pid = _tuple$7[0], handle = _tuple$7[1], err = _tuple$7[2];
					return [pid, handle, err];
				}
			}
			dirp = (go$ptrType(Go$Uint16)).nil;
			if (!((attr.Dir.length === 0))) {
				_tuple$8 = UTF16PtrFromString(attr.Dir), dirp = _tuple$8[0], err = _tuple$8[1];
				if (!(go$interfaceIsEqual(err, null))) {
					_tuple$9 = [0, 0, err], pid = _tuple$9[0], handle = _tuple$9[1], err = _tuple$9[2];
					return [pid, handle, err];
				}
			}
			go$pkg.ForkLock.Lock();
			go$deferred.push({ recv: go$pkg.ForkLock, method: "Unlock", args: [] });
			_tuple$10 = GetCurrentProcess(), p = _tuple$10[0];
			fd = (go$sliceType(Handle)).make(attr.Files.length, 0, function() { return 0; });
			_ref = attr.Files;
			_i = 0;
			while (_i < _ref.length) {
				i = _i;
				if ((_slice = attr.Files, _index = i, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) > 0) {
					err$2 = DuplicateHandle(p, ((_slice$1 = attr.Files, _index$1 = i, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")) >>> 0), p, new (go$ptrType(Handle))(function() { return (_slice$2 = fd, _index$2 = i, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")); }, function(v) { _slice$3 = fd, _index$3 = i, (_index$3 >= 0 && _index$3 < _slice$3.length) ? (_slice$3.array[_slice$3.offset + _index$3] = v) : go$throwRuntimeError("index out of range"); }), 0, true, 2);
					if (!(go$interfaceIsEqual(err$2, null))) {
						_tuple$11 = [0, 0, err$2], pid = _tuple$11[0], handle = _tuple$11[1], err = _tuple$11[2];
						return [pid, handle, err];
					}
					go$deferred.push({ fun: CloseHandle, args: [(_slice$4 = fd, _index$4 = i, (_index$4 >= 0 && _index$4 < _slice$4.length) ? _slice$4.array[_slice$4.offset + _index$4] : go$throwRuntimeError("index out of range"))] });
				}
				_i++;
			}
			si = new StartupInfo.Ptr();
			si.Cb = 68;
			si.Flags = 256;
			if (sys.HideWindow) {
				si.Flags = (si.Flags | 1) >>> 0;
				si.ShowWindow = 0;
			}
			si.StdInput = (_slice$5 = fd, _index$5 = 0, (_index$5 >= 0 && _index$5 < _slice$5.length) ? _slice$5.array[_slice$5.offset + _index$5] : go$throwRuntimeError("index out of range"));
			si.StdOutput = (_slice$6 = fd, _index$6 = 1, (_index$6 >= 0 && _index$6 < _slice$6.length) ? _slice$6.array[_slice$6.offset + _index$6] : go$throwRuntimeError("index out of range"));
			si.StdErr = (_slice$7 = fd, _index$7 = 2, (_index$7 >= 0 && _index$7 < _slice$7.length) ? _slice$7.array[_slice$7.offset + _index$7] : go$throwRuntimeError("index out of range"));
			pi = new ProcessInformation.Ptr();
			flags = (sys.CreationFlags | 1024) >>> 0;
			err = CreateProcess(argv0p, argvp, (go$ptrType(SecurityAttributes)).nil, (go$ptrType(SecurityAttributes)).nil, true, flags, createEnvBlock(attr.Env), dirp, si, pi);
			if (!(go$interfaceIsEqual(err, null))) {
				_tuple$12 = [0, 0, err], pid = _tuple$12[0], handle = _tuple$12[1], err = _tuple$12[2];
				return [pid, handle, err];
			}
			go$deferred.push({ fun: CloseHandle, args: [pi.Thread] });
			_tuple$13 = [(pi.ProcessId >> 0), (pi.Process >>> 0), null], pid = _tuple$13[0], handle = _tuple$13[1], err = _tuple$13[2];
			return [pid, handle, err];
		} catch(go$err) {
			go$pushErr(go$err);
		} finally {
			go$callDeferred(go$deferred);
			return [pid, handle, err];
		}
	};
	var Exec = go$pkg.Exec = function(argv0, argv, envv) {
		var err;
		err = null;
		err = new Errno(536871042);
		return err;
	};
	var raceAcquire = function(addr) {
	};
	var raceReleaseMerge = function(addr) {
	};
	var raceReadRange = function(addr, len) {
	};
	var raceWriteRange = function(addr, len) {
	};
	var TranslateAccountName = go$pkg.TranslateAccountName = function(username, from, to, initSize) {
		var _tuple, u, e, b, n, v, _slice, _index, _slice$1, _index$1, v$1, v$2, _slice$2, _index$2, _slice$3, _index$3, v$3;
		_tuple = UTF16PtrFromString(username), u = _tuple[0], e = _tuple[1];
		if (!(go$interfaceIsEqual(e, null))) {
			return ["", e];
		}
		b = (go$sliceType(Go$Uint16)).make(50, 0, function() { return 0; });
		n = (b.length >>> 0);
		e = TranslateName(u, from, to, new (go$ptrType(Go$Uint16))(function() { return (_slice = b, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")); }, function(v) { _slice$1 = b, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = v) : go$throwRuntimeError("index out of range"); }), new (go$ptrType(Go$Uint32))(function() { return n; }, function(v$1) { n = v$1; }));
		if (!(go$interfaceIsEqual(e, null))) {
			if (!(go$interfaceIsEqual(e, new Errno(122)))) {
				return ["", e];
			}
			b = (go$sliceType(Go$Uint16)).make(n, 0, function() { return 0; });
			e = TranslateName(u, from, to, new (go$ptrType(Go$Uint16))(function() { return (_slice$2 = b, _index$2 = 0, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")); }, function(v$2) { _slice$3 = b, _index$3 = 0, (_index$3 >= 0 && _index$3 < _slice$3.length) ? (_slice$3.array[_slice$3.offset + _index$3] = v$2) : go$throwRuntimeError("index out of range"); }), new (go$ptrType(Go$Uint32))(function() { return n; }, function(v$3) { n = v$3; }));
			if (!(go$interfaceIsEqual(e, null))) {
				return ["", e];
			}
		}
		return [UTF16ToString(b), null];
	};
	var StringToSid = go$pkg.StringToSid = function(s) {
		var sid, _tuple, p, e, v, _array, _struct, _view;
		var go$deferred = [];
		try {
			sid = (go$ptrType(SID)).nil;
			_tuple = UTF16PtrFromString(s), p = _tuple[0], e = _tuple[1];
			if (!(go$interfaceIsEqual(e, null))) {
				return [(go$ptrType(SID)).nil, e];
			}
			e = ConvertStringSidToSid(p, new (go$ptrType((go$ptrType(SID))))(function() { return sid; }, function(v) { sid = v; }));
			if (!(go$interfaceIsEqual(e, null))) {
				return [(go$ptrType(SID)).nil, e];
			}
			_array = new Uint8Array(0);
			go$deferred.push({ fun: LocalFree, args: [_array] });
			_struct = sid, _view = new DataView(_array.buffer, _array.byteOffset);
			return sid.Copy();
		} catch(go$err) {
			go$pushErr(go$err);
			return [(go$ptrType(SID)).nil, null];
		} finally {
			go$callDeferred(go$deferred);
		}
	};
	var LookupSID = go$pkg.LookupSID = function(system, account) {
		var sid, domain, accType, err, _tuple, _tuple$1, acc, e, _tuple$2, sys, _tuple$3, _tuple$4, db, dn, b, n, _array, _struct, _view, v, v$1, _slice, _index, _slice$1, _index$1, v$2, v$3, _tuple$5, _array$1, _struct$1, _view$1, v$4, v$5, _slice$2, _index$2, _slice$3, _index$3, v$6, v$7, _tuple$6, _tuple$7;
		sid = (go$ptrType(SID)).nil;
		domain = "";
		accType = 0;
		err = null;
		if (account.length === 0) {
			_tuple = [(go$ptrType(SID)).nil, "", 0, new Errno(536870951)], sid = _tuple[0], domain = _tuple[1], accType = _tuple[2], err = _tuple[3];
			return [sid, domain, accType, err];
		}
		_tuple$1 = UTF16PtrFromString(account), acc = _tuple$1[0], e = _tuple$1[1];
		if (!(go$interfaceIsEqual(e, null))) {
			_tuple$2 = [(go$ptrType(SID)).nil, "", 0, e], sid = _tuple$2[0], domain = _tuple$2[1], accType = _tuple$2[2], err = _tuple$2[3];
			return [sid, domain, accType, err];
		}
		sys = (go$ptrType(Go$Uint16)).nil;
		if (system.length > 0) {
			_tuple$3 = UTF16PtrFromString(system), sys = _tuple$3[0], e = _tuple$3[1];
			if (!(go$interfaceIsEqual(e, null))) {
				_tuple$4 = [(go$ptrType(SID)).nil, "", 0, e], sid = _tuple$4[0], domain = _tuple$4[1], accType = _tuple$4[2], err = _tuple$4[3];
				return [sid, domain, accType, err];
			}
		}
		db = (go$sliceType(Go$Uint16)).make(50, 0, function() { return 0; });
		dn = (db.length >>> 0);
		b = (go$sliceType(Go$Uint8)).make(50, 0, function() { return 0; });
		n = (b.length >>> 0);
		sid = (_array = go$sliceToArray(b), _struct = new SID.Ptr(), _view = new DataView(_array.buffer, _array.byteOffset), _struct);
		e = LookupAccountName(sys, acc, sid, new (go$ptrType(Go$Uint32))(function() { return n; }, function(v) { n = v; }), new (go$ptrType(Go$Uint16))(function() { return (_slice = db, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")); }, function(v$1) { _slice$1 = db, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = v$1) : go$throwRuntimeError("index out of range"); }), new (go$ptrType(Go$Uint32))(function() { return dn; }, function(v$2) { dn = v$2; }), new (go$ptrType(Go$Uint32))(function() { return accType; }, function(v$3) { accType = v$3; }));
		if (!(go$interfaceIsEqual(e, null))) {
			if (!(go$interfaceIsEqual(e, new Errno(122)))) {
				_tuple$5 = [(go$ptrType(SID)).nil, "", 0, e], sid = _tuple$5[0], domain = _tuple$5[1], accType = _tuple$5[2], err = _tuple$5[3];
				return [sid, domain, accType, err];
			}
			b = (go$sliceType(Go$Uint8)).make(n, 0, function() { return 0; });
			sid = (_array$1 = go$sliceToArray(b), _struct$1 = new SID.Ptr(), _view$1 = new DataView(_array$1.buffer, _array$1.byteOffset), _struct$1);
			db = (go$sliceType(Go$Uint16)).make(dn, 0, function() { return 0; });
			e = LookupAccountName(sys, acc, sid, new (go$ptrType(Go$Uint32))(function() { return n; }, function(v$4) { n = v$4; }), new (go$ptrType(Go$Uint16))(function() { return (_slice$2 = db, _index$2 = 0, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")); }, function(v$5) { _slice$3 = db, _index$3 = 0, (_index$3 >= 0 && _index$3 < _slice$3.length) ? (_slice$3.array[_slice$3.offset + _index$3] = v$5) : go$throwRuntimeError("index out of range"); }), new (go$ptrType(Go$Uint32))(function() { return dn; }, function(v$6) { dn = v$6; }), new (go$ptrType(Go$Uint32))(function() { return accType; }, function(v$7) { accType = v$7; }));
			if (!(go$interfaceIsEqual(e, null))) {
				_tuple$6 = [(go$ptrType(SID)).nil, "", 0, e], sid = _tuple$6[0], domain = _tuple$6[1], accType = _tuple$6[2], err = _tuple$6[3];
				return [sid, domain, accType, err];
			}
		}
		_tuple$7 = [sid, UTF16ToString(db), accType, null], sid = _tuple$7[0], domain = _tuple$7[1], accType = _tuple$7[2], err = _tuple$7[3];
		return [sid, domain, accType, err];
	};
	SID.Ptr.prototype.String = function() {
		var sid, s, v, e;
		var go$deferred = [];
		try {
			sid = this;
			s = (go$ptrType(Go$Uint16)).nil;
			e = ConvertSidToStringSid(sid, new (go$ptrType((go$ptrType(Go$Uint16))))(function() { return s; }, function(v) { s = v; }));
			if (!(go$interfaceIsEqual(e, null))) {
				return ["", e];
			}
			go$deferred.push({ fun: LocalFree, args: [s] });
			return [UTF16ToString(new (go$sliceType(Go$Uint16))(s)), null];
		} catch(go$err) {
			go$pushErr(go$err);
			return ["", null];
		} finally {
			go$callDeferred(go$deferred);
		}
	};
	SID.prototype.String = function() { return this.go$val.String(); };
	SID.Ptr.prototype.Len = function() {
		var sid;
		sid = this;
		return (GetLengthSid(sid) >> 0);
	};
	SID.prototype.Len = function() { return this.go$val.Len(); };
	SID.Ptr.prototype.Copy = function() {
		var sid, b, _array, _struct, _view, sid2, e;
		sid = this;
		b = (go$sliceType(Go$Uint8)).make(sid.Len(), 0, function() { return 0; });
		sid2 = (_array = go$sliceToArray(b), _struct = new SID.Ptr(), _view = new DataView(_array.buffer, _array.byteOffset), _struct);
		e = CopySid((b.length >>> 0), sid2, sid);
		if (!(go$interfaceIsEqual(e, null))) {
			return [(go$ptrType(SID)).nil, e];
		}
		return [sid2, null];
	};
	SID.prototype.Copy = function() { return this.go$val.Copy(); };
	SID.Ptr.prototype.LookupAccount = function(system) {
		var account, domain, accType, err, sid, sys, _tuple, _tuple$1, b, n, db, dn, v, _slice, _index, _slice$1, _index$1, v$1, v$2, _slice$2, _index$2, _slice$3, _index$3, v$3, v$4, e, _tuple$2, v$5, _slice$4, _index$4, _slice$5, _index$5, v$6, v$7, _slice$6, _index$6, _slice$7, _index$7, v$8, v$9, _tuple$3, _tuple$4;
		account = "";
		domain = "";
		accType = 0;
		err = null;
		sid = this;
		sys = (go$ptrType(Go$Uint16)).nil;
		if (system.length > 0) {
			_tuple = UTF16PtrFromString(system), sys = _tuple[0], err = _tuple[1];
			if (!(go$interfaceIsEqual(err, null))) {
				_tuple$1 = ["", "", 0, err], account = _tuple$1[0], domain = _tuple$1[1], accType = _tuple$1[2], err = _tuple$1[3];
				return [account, domain, accType, err];
			}
		}
		b = (go$sliceType(Go$Uint16)).make(50, 0, function() { return 0; });
		n = (b.length >>> 0);
		db = (go$sliceType(Go$Uint16)).make(50, 0, function() { return 0; });
		dn = (db.length >>> 0);
		e = LookupAccountSid(sys, sid, new (go$ptrType(Go$Uint16))(function() { return (_slice = b, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")); }, function(v) { _slice$1 = b, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = v) : go$throwRuntimeError("index out of range"); }), new (go$ptrType(Go$Uint32))(function() { return n; }, function(v$1) { n = v$1; }), new (go$ptrType(Go$Uint16))(function() { return (_slice$2 = db, _index$2 = 0, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")); }, function(v$2) { _slice$3 = db, _index$3 = 0, (_index$3 >= 0 && _index$3 < _slice$3.length) ? (_slice$3.array[_slice$3.offset + _index$3] = v$2) : go$throwRuntimeError("index out of range"); }), new (go$ptrType(Go$Uint32))(function() { return dn; }, function(v$3) { dn = v$3; }), new (go$ptrType(Go$Uint32))(function() { return accType; }, function(v$4) { accType = v$4; }));
		if (!(go$interfaceIsEqual(e, null))) {
			if (!(go$interfaceIsEqual(e, new Errno(122)))) {
				_tuple$2 = ["", "", 0, e], account = _tuple$2[0], domain = _tuple$2[1], accType = _tuple$2[2], err = _tuple$2[3];
				return [account, domain, accType, err];
			}
			b = (go$sliceType(Go$Uint16)).make(n, 0, function() { return 0; });
			db = (go$sliceType(Go$Uint16)).make(dn, 0, function() { return 0; });
			e = LookupAccountSid((go$ptrType(Go$Uint16)).nil, sid, new (go$ptrType(Go$Uint16))(function() { return (_slice$4 = b, _index$4 = 0, (_index$4 >= 0 && _index$4 < _slice$4.length) ? _slice$4.array[_slice$4.offset + _index$4] : go$throwRuntimeError("index out of range")); }, function(v$5) { _slice$5 = b, _index$5 = 0, (_index$5 >= 0 && _index$5 < _slice$5.length) ? (_slice$5.array[_slice$5.offset + _index$5] = v$5) : go$throwRuntimeError("index out of range"); }), new (go$ptrType(Go$Uint32))(function() { return n; }, function(v$6) { n = v$6; }), new (go$ptrType(Go$Uint16))(function() { return (_slice$6 = db, _index$6 = 0, (_index$6 >= 0 && _index$6 < _slice$6.length) ? _slice$6.array[_slice$6.offset + _index$6] : go$throwRuntimeError("index out of range")); }, function(v$7) { _slice$7 = db, _index$7 = 0, (_index$7 >= 0 && _index$7 < _slice$7.length) ? (_slice$7.array[_slice$7.offset + _index$7] = v$7) : go$throwRuntimeError("index out of range"); }), new (go$ptrType(Go$Uint32))(function() { return dn; }, function(v$8) { dn = v$8; }), new (go$ptrType(Go$Uint32))(function() { return accType; }, function(v$9) { accType = v$9; }));
			if (!(go$interfaceIsEqual(e, null))) {
				_tuple$3 = ["", "", 0, e], account = _tuple$3[0], domain = _tuple$3[1], accType = _tuple$3[2], err = _tuple$3[3];
				return [account, domain, accType, err];
			}
		}
		_tuple$4 = [UTF16ToString(b), UTF16ToString(db), accType, null], account = _tuple$4[0], domain = _tuple$4[1], accType = _tuple$4[2], err = _tuple$4[3];
		return [account, domain, accType, err];
	};
	SID.prototype.LookupAccount = function(system) { return this.go$val.LookupAccount(system); };
	var OpenCurrentProcessToken = go$pkg.OpenCurrentProcessToken = function() {
		var _tuple, p, e, t, v;
		_tuple = GetCurrentProcess(), p = _tuple[0], e = _tuple[1];
		if (!(go$interfaceIsEqual(e, null))) {
			return [0, e];
		}
		t = 0;
		e = OpenProcessToken(p, 8, new (go$ptrType(Token))(function() { return t; }, function(v) { t = v; }));
		if (!(go$interfaceIsEqual(e, null))) {
			return [0, e];
		}
		return [t, null];
	};
	Token.prototype.Close = function() {
		var t;
		t = this.go$val;
		return CloseHandle((t >>> 0));
	};
	go$ptrType(Token).prototype.Close = function() { return new Token(this.go$get()).Close(); };
	Token.prototype.getInfo = function(class$1, initSize) {
		var t, b, n, v, _slice, _index, _slice$1, _index$1, v$1, e, v$2, _slice$2, _index$2, _slice$3, _index$3, v$3;
		t = this.go$val;
		b = (go$sliceType(Go$Uint8)).make(initSize, 0, function() { return 0; });
		n = 0;
		e = GetTokenInformation(t, class$1, new (go$ptrType(Go$Uint8))(function() { return (_slice = b, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")); }, function(v) { _slice$1 = b, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = v) : go$throwRuntimeError("index out of range"); }), (b.length >>> 0), new (go$ptrType(Go$Uint32))(function() { return n; }, function(v$1) { n = v$1; }));
		if (!(go$interfaceIsEqual(e, null))) {
			if (!(go$interfaceIsEqual(e, new Errno(122)))) {
				return [0, e];
			}
			b = (go$sliceType(Go$Uint8)).make(n, 0, function() { return 0; });
			e = GetTokenInformation(t, class$1, new (go$ptrType(Go$Uint8))(function() { return (_slice$2 = b, _index$2 = 0, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")); }, function(v$2) { _slice$3 = b, _index$3 = 0, (_index$3 >= 0 && _index$3 < _slice$3.length) ? (_slice$3.array[_slice$3.offset + _index$3] = v$2) : go$throwRuntimeError("index out of range"); }), (b.length >>> 0), new (go$ptrType(Go$Uint32))(function() { return n; }, function(v$3) { n = v$3; }));
			if (!(go$interfaceIsEqual(e, null))) {
				return [0, e];
			}
		}
		return [go$sliceToArray(b), null];
	};
	go$ptrType(Token).prototype.getInfo = function(class$1, initSize) { return new Token(this.go$get()).getInfo(class$1, initSize); };
	Token.prototype.GetTokenUser = function() {
		var t, _tuple, i, e, _array, _struct, _view;
		t = this.go$val;
		_tuple = (new Token(t)).getInfo(1, 50), i = _tuple[0], e = _tuple[1];
		if (!(go$interfaceIsEqual(e, null))) {
			return [(go$ptrType(Tokenuser)).nil, e];
		}
		return [(_array = i, _struct = new Tokenuser.Ptr(), _view = new DataView(_array.buffer, _array.byteOffset), _struct.User.Attributes = _view.getUint32(4, true), _struct), null];
	};
	go$ptrType(Token).prototype.GetTokenUser = function() { return new Token(this.go$get()).GetTokenUser(); };
	Token.prototype.GetTokenPrimaryGroup = function() {
		var t, _tuple, i, e, _array, _struct, _view;
		t = this.go$val;
		_tuple = (new Token(t)).getInfo(5, 50), i = _tuple[0], e = _tuple[1];
		if (!(go$interfaceIsEqual(e, null))) {
			return [(go$ptrType(Tokenprimarygroup)).nil, e];
		}
		return [(_array = i, _struct = new Tokenprimarygroup.Ptr(), _view = new DataView(_array.buffer, _array.byteOffset), _struct), null];
	};
	go$ptrType(Token).prototype.GetTokenPrimaryGroup = function() { return new Token(this.go$get()).GetTokenPrimaryGroup(); };
	Token.prototype.GetUserProfileDirectory = function() {
		var t, b, n, v, _slice, _index, _slice$1, _index$1, v$1, e, v$2, _slice$2, _index$2, _slice$3, _index$3, v$3;
		t = this.go$val;
		b = (go$sliceType(Go$Uint16)).make(100, 0, function() { return 0; });
		n = (b.length >>> 0);
		e = GetUserProfileDirectory(t, new (go$ptrType(Go$Uint16))(function() { return (_slice = b, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")); }, function(v) { _slice$1 = b, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = v) : go$throwRuntimeError("index out of range"); }), new (go$ptrType(Go$Uint32))(function() { return n; }, function(v$1) { n = v$1; }));
		if (!(go$interfaceIsEqual(e, null))) {
			if (!(go$interfaceIsEqual(e, new Errno(122)))) {
				return ["", e];
			}
			b = (go$sliceType(Go$Uint16)).make(n, 0, function() { return 0; });
			e = GetUserProfileDirectory(t, new (go$ptrType(Go$Uint16))(function() { return (_slice$2 = b, _index$2 = 0, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")); }, function(v$2) { _slice$3 = b, _index$3 = 0, (_index$3 >= 0 && _index$3 < _slice$3.length) ? (_slice$3.array[_slice$3.offset + _index$3] = v$2) : go$throwRuntimeError("index out of range"); }), new (go$ptrType(Go$Uint32))(function() { return n; }, function(v$3) { n = v$3; }));
			if (!(go$interfaceIsEqual(e, null))) {
				return ["", e];
			}
		}
		return [UTF16ToString(b), null];
	};
	go$ptrType(Token).prototype.GetUserProfileDirectory = function() { return new Token(this.go$get()).GetUserProfileDirectory(); };
	var itoa = function(val) {
		var buf, i, _r, _q;
		if (val < 0) {
			return "-" + itoa(-val);
		}
		buf = go$makeNativeArray("Uint8", 32, function() { return 0; });
		i = 31;
		while (val >= 10) {
			buf[i] = (((_r = val % 10, _r === _r ? _r : go$throwRuntimeError("integer divide by zero")) + 48 >> 0) << 24 >>> 24);
			i = i - 1 >> 0;
			val = (_q = val / 10, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
		}
		buf[i] = ((val + 48 >> 0) << 24 >>> 24);
		return go$bytesToString(go$subslice(new (go$sliceType(Go$Uint8))(buf), i));
	};
	var StringByteSlice = go$pkg.StringByteSlice = function(s) {
		var _tuple, a, err;
		_tuple = ByteSliceFromString(s), a = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			throw go$panic(new Go$String("syscall: string with NUL passed to StringByteSlice"));
		}
		return a;
	};
	var ByteSliceFromString = go$pkg.ByteSliceFromString = function(s) {
		var i, a;
		i = 0;
		while (i < s.length) {
			if (s.charCodeAt(i) === 0) {
				return [(go$sliceType(Go$Uint8)).nil, new Errno(536870951)];
			}
			i = i + 1 >> 0;
		}
		a = (go$sliceType(Go$Uint8)).make(s.length + 1 >> 0, 0, function() { return 0; });
		go$copyString(a, s);
		return [a, null];
	};
	var StringBytePtr = go$pkg.StringBytePtr = function(s) {
		var v, _slice, _index, _slice$1, _index$1;
		return new (go$ptrType(Go$Uint8))(function() { return (_slice = StringByteSlice(s), _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")); }, function(v) { _slice$1 = StringByteSlice(s), _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = v) : go$throwRuntimeError("index out of range"); });
	};
	var BytePtrFromString = go$pkg.BytePtrFromString = function(s) {
		var _tuple, a, err, v, _slice, _index, _slice$1, _index$1;
		_tuple = ByteSliceFromString(s), a = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			return [(go$ptrType(Go$Uint8)).nil, err];
		}
		return [new (go$ptrType(Go$Uint8))(function() { return (_slice = a, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")); }, function(v) { _slice$1 = a, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = v) : go$throwRuntimeError("index out of range"); }), null];
	};
	Timespec.Ptr.prototype.Unix = function() {
		var sec, nsec, ts, _tuple;
		sec = new Go$Int64(0, 0);
		nsec = new Go$Int64(0, 0);
		ts = this;
		_tuple = [ts.Sec, ts.Nsec], sec = _tuple[0], nsec = _tuple[1];
		return [sec, nsec];
	};
	Timespec.prototype.Unix = function() { return this.go$val.Unix(); };
	Timeval.Ptr.prototype.Unix = function() {
		var sec, nsec, tv, _tuple;
		sec = new Go$Int64(0, 0);
		nsec = new Go$Int64(0, 0);
		tv = this;
		_tuple = [new Go$Int64(0, tv.Sec), go$mul64(new Go$Int64(0, tv.Usec), new Go$Int64(0, 1000))], sec = _tuple[0], nsec = _tuple[1];
		return [sec, nsec];
	};
	Timeval.prototype.Unix = function() { return this.go$val.Unix(); };
	Timespec.Ptr.prototype.Nano = function() {
		var ts, x, x$1;
		ts = this;
		return (x = go$mul64(ts.Sec, new Go$Int64(0, 1000000000)), x$1 = ts.Nsec, new Go$Int64(x.high + x$1.high, x.low + x$1.low));
	};
	Timespec.prototype.Nano = function() { return this.go$val.Nano(); };
	Timeval.Ptr.prototype.Nano = function() {
		var tv, x, x$1;
		tv = this;
		return (x = go$mul64(new Go$Int64(0, tv.Sec), new Go$Int64(0, 1000000000)), x$1 = go$mul64(new Go$Int64(0, tv.Usec), new Go$Int64(0, 1000)), new Go$Int64(x.high + x$1.high, x.low + x$1.low));
	};
	Timeval.prototype.Nano = function() { return this.go$val.Nano(); };
	var StringToUTF16 = go$pkg.StringToUTF16 = function(s) {
		var _tuple, a, err;
		_tuple = UTF16FromString(s), a = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			throw go$panic(new Go$String("syscall: string with NUL passed to StringToUTF16"));
		}
		return a;
	};
	var UTF16FromString = go$pkg.UTF16FromString = function(s) {
		var i;
		i = 0;
		while (i < s.length) {
			if (s.charCodeAt(i) === 0) {
				return [(go$sliceType(Go$Uint16)).nil, new Errno(536870951)];
			}
			i = i + 1 >> 0;
		}
		return [utf16.Encode(new (go$sliceType(Go$Int32))(go$stringToRunes(s + "\x00"))), null];
	};
	var UTF16ToString = go$pkg.UTF16ToString = function(s) {
		var _ref, _i, _slice, _index, v, i;
		_ref = s;
		_i = 0;
		while (_i < _ref.length) {
			v = (_slice = _ref, _index = _i, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range"));
			i = _i;
			if (v === 0) {
				s = go$subslice(s, 0, i);
				break;
			}
			_i++;
		}
		return go$runesToString(utf16.Decode(s));
	};
	var StringToUTF16Ptr = go$pkg.StringToUTF16Ptr = function(s) {
		var v, _slice, _index, _slice$1, _index$1;
		return new (go$ptrType(Go$Uint16))(function() { return (_slice = StringToUTF16(s), _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")); }, function(v) { _slice$1 = StringToUTF16(s), _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = v) : go$throwRuntimeError("index out of range"); });
	};
	var UTF16PtrFromString = go$pkg.UTF16PtrFromString = function(s) {
		var _tuple, a, err, v, _slice, _index, _slice$1, _index$1;
		_tuple = UTF16FromString(s), a = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			return [(go$ptrType(Go$Uint16)).nil, err];
		}
		return [new (go$ptrType(Go$Uint16))(function() { return (_slice = a, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")); }, function(v) { _slice$1 = a, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = v) : go$throwRuntimeError("index out of range"); }), null];
	};
	var Getpagesize = go$pkg.Getpagesize = function() {
		return 4096;
	};
	var langid = function(pri, sub) {
		return (((sub >>> 0) << 10 >>> 0) | (pri >>> 0)) >>> 0;
	};
	Errno.prototype.Error = function() {
		var e, idx, flags, b, _tuple, n, err, _tuple$1, _slice, _index, _slice$1, _index$1;
		e = this.go$val;
		idx = ((e - 536870912 >>> 0) >> 0);
		if (0 <= idx && idx < 131) {
			return errors[idx];
		}
		flags = 12800;
		b = (go$sliceType(Go$Uint16)).make(300, 0, function() { return 0; });
		_tuple = FormatMessage(flags, 0, (e >>> 0), langid(9, 1), b, (go$ptrType(Go$Uint8)).nil), n = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			_tuple$1 = FormatMessage(flags, 0, (e >>> 0), 0, b, (go$ptrType(Go$Uint8)).nil), n = _tuple$1[0], err = _tuple$1[1];
			if (!(go$interfaceIsEqual(err, null))) {
				return "winapi error #" + itoa((e >> 0));
			}
		}
		while (n > 0 && (((_slice = b, _index = (n - 1 >>> 0), (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) === 10) || ((_slice$1 = b, _index$1 = (n - 1 >>> 0), (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")) === 13))) {
			n = n - 1 >>> 0;
		}
		return go$runesToString(utf16.Decode(go$subslice(b, 0, n)));
	};
	go$ptrType(Errno).prototype.Error = function() { return new Errno(this.go$get()).Error(); };
	Errno.prototype.Temporary = function() {
		var e;
		e = this.go$val;
		return (e === 536870950) || (e === 536870971) || (new Errno(e)).Timeout();
	};
	go$ptrType(Errno).prototype.Temporary = function() { return new Errno(this.go$get()).Temporary(); };
	Errno.prototype.Timeout = function() {
		var e;
		e = this.go$val;
		return (e === 536870918) || (e === 536871039) || (e === 536871033);
	};
	go$ptrType(Errno).prototype.Timeout = function() { return new Errno(this.go$get()).Timeout(); };
	var NewCallback = go$pkg.NewCallback = function(fn) {
		throw go$panic("Native function not implemented: NewCallback");
	};
	var Exit = go$pkg.Exit = function(code) {
		ExitProcess((code >>> 0));
	};
	var makeInheritSa = function() {
		var sa;
		sa = new SecurityAttributes.Ptr();
		sa.Length = 12;
		sa.InheritHandle = 1;
		return sa;
	};
	var Open = go$pkg.Open = function(path, mode, perm) {
		var fd, err, _tuple, _tuple$1, pathp, _tuple$2, access, _ref, sharemode, sa, createmode, _tuple$3, h, e, _tuple$4;
		fd = 0;
		err = null;
		if (path.length === 0) {
			_tuple = [4294967295, new Errno(2)], fd = _tuple[0], err = _tuple[1];
			return [fd, err];
		}
		_tuple$1 = UTF16PtrFromString(path), pathp = _tuple$1[0], err = _tuple$1[1];
		if (!(go$interfaceIsEqual(err, null))) {
			_tuple$2 = [4294967295, err], fd = _tuple$2[0], err = _tuple$2[1];
			return [fd, err];
		}
		access = 0;
		_ref = mode & 3;
		if (_ref === 0) {
			access = 2147483648;
		} else if (_ref === 1) {
			access = 1073741824;
		} else if (_ref === 2) {
			access = 3221225472;
		}
		if (!(((mode & 64) === 0))) {
			access = (access | 1073741824) >>> 0;
		}
		if (!(((mode & 1024) === 0))) {
			access = access & ~1073741824;
			access = (access | 4) >>> 0;
		}
		sharemode = 3;
		sa = (go$ptrType(SecurityAttributes)).nil;
		if ((mode & 524288) === 0) {
			sa = makeInheritSa();
		}
		createmode = 0;
		if ((mode & 192) === 192) {
			createmode = 1;
		} else if ((mode & 576) === 576) {
			createmode = 2;
		} else if ((mode & 64) === 64) {
			createmode = 4;
		} else if ((mode & 512) === 512) {
			createmode = 5;
		} else {
			createmode = 3;
		}
		_tuple$3 = CreateFile(pathp, access, sharemode, sa, createmode, 128, 0), h = _tuple$3[0], e = _tuple$3[1];
		_tuple$4 = [h, e], fd = _tuple$4[0], err = _tuple$4[1];
		return [fd, err];
	};
	var Read = go$pkg.Read = function(fd, p) {
		var n, err, done, v, e, _tuple, _tuple$1, _tuple$2;
		n = 0;
		err = null;
		done = 0;
		e = ReadFile(fd, p, new (go$ptrType(Go$Uint32))(function() { return done; }, function(v) { done = v; }), (go$ptrType(Overlapped)).nil);
		if (!(go$interfaceIsEqual(e, null))) {
			if (go$interfaceIsEqual(e, new Errno(109))) {
				_tuple = [0, null], n = _tuple[0], err = _tuple[1];
				return [n, err];
			}
			_tuple$1 = [0, e], n = _tuple$1[0], err = _tuple$1[1];
			return [n, err];
		}
		_tuple$2 = [(done >> 0), null], n = _tuple$2[0], err = _tuple$2[1];
		return [n, err];
	};
	var Write = go$pkg.Write = function(fd, p) {
		var n, err, done, v, e, _tuple, _tuple$1;
		n = 0;
		err = null;
		done = 0;
		e = WriteFile(fd, p, new (go$ptrType(Go$Uint32))(function() { return done; }, function(v) { done = v; }), (go$ptrType(Overlapped)).nil);
		if (!(go$interfaceIsEqual(e, null))) {
			_tuple = [0, e], n = _tuple[0], err = _tuple[1];
			return [n, err];
		}
		_tuple$1 = [(done >> 0), null], n = _tuple$1[0], err = _tuple$1[1];
		return [n, err];
	};
	var Seek = go$pkg.Seek = function(fd, offset, whence) {
		var newoffset, err, w, _ref, x, hi, lo, _tuple, ft, _tuple$1, _tuple$2, v, rlo, e, _tuple$3, x$1, x$2, _tuple$4;
		newoffset = new Go$Int64(0, 0);
		err = null;
		w = 0;
		_ref = whence;
		if (_ref === 0) {
			w = 0;
		} else if (_ref === 1) {
			w = 1;
		} else if (_ref === 2) {
			w = 2;
		}
		hi = ((x = go$shiftRightInt64(offset, 32), x.low + ((x.high >> 31) * 4294967296)) >> 0);
		lo = ((offset.low + ((offset.high >> 31) * 4294967296)) >> 0);
		_tuple = GetFileType(fd), ft = _tuple[0];
		if (ft === 3) {
			_tuple$1 = [new Go$Int64(0, 0), new Errno(536871015)], newoffset = _tuple$1[0], err = _tuple$1[1];
			return [newoffset, err];
		}
		_tuple$2 = SetFilePointer(fd, lo, new (go$ptrType(Go$Int32))(function() { return hi; }, function(v) { hi = v; }), w), rlo = _tuple$2[0], e = _tuple$2[1];
		if (!(go$interfaceIsEqual(e, null))) {
			_tuple$3 = [new Go$Int64(0, 0), e], newoffset = _tuple$3[0], err = _tuple$3[1];
			return [newoffset, err];
		}
		_tuple$4 = [(x$1 = go$shiftLeft64(new Go$Int64(0, hi), 32), x$2 = new Go$Int64(0, rlo), new Go$Int64(x$1.high + x$2.high, x$1.low + x$2.low)), null], newoffset = _tuple$4[0], err = _tuple$4[1];
		return [newoffset, err];
	};
	var Close = go$pkg.Close = function(fd) {
		var err;
		err = null;
		err = CloseHandle(fd);
		return err;
	};
	var getStdHandle = function(h) {
		var fd, _tuple, r;
		fd = 0;
		_tuple = GetStdHandle(h), r = _tuple[0];
		CloseOnExec(r);
		fd = r;
		return fd;
	};
	var Getwd = go$pkg.Getwd = function() {
		var wd, err, b, _tuple, v, _slice, _index, _slice$1, _index$1, n, e, _tuple$1, _tuple$2;
		wd = "";
		err = null;
		b = (go$sliceType(Go$Uint16)).make(300, 0, function() { return 0; });
		_tuple = GetCurrentDirectory((b.length >>> 0), new (go$ptrType(Go$Uint16))(function() { return (_slice = b, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")); }, function(v) { _slice$1 = b, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = v) : go$throwRuntimeError("index out of range"); })), n = _tuple[0], e = _tuple[1];
		if (!(go$interfaceIsEqual(e, null))) {
			_tuple$1 = ["", e], wd = _tuple$1[0], err = _tuple$1[1];
			return [wd, err];
		}
		_tuple$2 = [go$runesToString(utf16.Decode(go$subslice(b, 0, n))), null], wd = _tuple$2[0], err = _tuple$2[1];
		return [wd, err];
	};
	var Chdir = go$pkg.Chdir = function(path) {
		var err, _tuple, pathp;
		err = null;
		_tuple = UTF16PtrFromString(path), pathp = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			err = err;
			return err;
		}
		err = SetCurrentDirectory(pathp);
		return err;
	};
	var Mkdir = go$pkg.Mkdir = function(path, mode) {
		var err, _tuple, pathp;
		err = null;
		_tuple = UTF16PtrFromString(path), pathp = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			err = err;
			return err;
		}
		err = CreateDirectory(pathp, (go$ptrType(SecurityAttributes)).nil);
		return err;
	};
	var Rmdir = go$pkg.Rmdir = function(path) {
		var err, _tuple, pathp;
		err = null;
		_tuple = UTF16PtrFromString(path), pathp = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			err = err;
			return err;
		}
		err = RemoveDirectory(pathp);
		return err;
	};
	var Unlink = go$pkg.Unlink = function(path) {
		var err, _tuple, pathp;
		err = null;
		_tuple = UTF16PtrFromString(path), pathp = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			err = err;
			return err;
		}
		err = DeleteFile(pathp);
		return err;
	};
	var Rename = go$pkg.Rename = function(oldpath, newpath) {
		var err, _tuple, from, _tuple$1, to;
		err = null;
		_tuple = UTF16PtrFromString(oldpath), from = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			err = err;
			return err;
		}
		_tuple$1 = UTF16PtrFromString(newpath), to = _tuple$1[0], err = _tuple$1[1];
		if (!(go$interfaceIsEqual(err, null))) {
			err = err;
			return err;
		}
		err = MoveFile(from, to);
		return err;
	};
	var ComputerName = go$pkg.ComputerName = function() {
		var name, err, n, b, v, _slice, _index, _slice$1, _index$1, v$1, e, _tuple, _tuple$1;
		name = "";
		err = null;
		n = 16;
		b = (go$sliceType(Go$Uint16)).make(n, 0, function() { return 0; });
		e = GetComputerName(new (go$ptrType(Go$Uint16))(function() { return (_slice = b, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")); }, function(v) { _slice$1 = b, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = v) : go$throwRuntimeError("index out of range"); }), new (go$ptrType(Go$Uint32))(function() { return n; }, function(v$1) { n = v$1; }));
		if (!(go$interfaceIsEqual(e, null))) {
			_tuple = ["", e], name = _tuple[0], err = _tuple[1];
			return [name, err];
		}
		_tuple$1 = [go$runesToString(utf16.Decode(go$subslice(b, 0, n))), null], name = _tuple$1[0], err = _tuple$1[1];
		return [name, err];
	};
	var Ftruncate = go$pkg.Ftruncate = function(fd, length) {
		var err, _tuple, curoffset, e, _tuple$1;
		err = null;
		var go$deferred = [];
		try {
			_tuple = Seek(fd, new Go$Int64(0, 0), 1), curoffset = _tuple[0], e = _tuple[1];
			if (!(go$interfaceIsEqual(e, null))) {
				err = e;
				return err;
			}
			go$deferred.push({ fun: Seek, args: [fd, curoffset, 0] });
			_tuple$1 = Seek(fd, length, 0), e = _tuple$1[1];
			if (!(go$interfaceIsEqual(e, null))) {
				err = e;
				return err;
			}
			e = SetEndOfFile(fd);
			if (!(go$interfaceIsEqual(e, null))) {
				err = e;
				return err;
			}
			err = null;
			return err;
		} catch(go$err) {
			go$pushErr(go$err);
		} finally {
			go$callDeferred(go$deferred);
			return err;
		}
	};
	var Gettimeofday = go$pkg.Gettimeofday = function(tv) {
		var err, ft, _struct, l, r;
		err = null;
		ft = new Filetime.Ptr();
		GetSystemTimeAsFileTime(ft);
		l = tv, r = (_struct = NsecToTimeval(ft.Nanoseconds()), new Timeval.Ptr(_struct.Sec, _struct.Usec)), l.Sec = r.Sec, l.Usec = r.Usec;
		err = null;
		return err;
	};
	var Pipe = go$pkg.Pipe = function(p) {
		var err, _tuple, r, w, v, v$1, e, _slice, _index, _slice$1, _index$1;
		err = null;
		if (!((p.length === 2))) {
			err = new Errno(536870951);
			return err;
		}
		_tuple = [0, 0], r = _tuple[0], w = _tuple[1];
		e = CreatePipe(new (go$ptrType(Handle))(function() { return r; }, function(v) { r = v; }), new (go$ptrType(Handle))(function() { return w; }, function(v$1) { w = v$1; }), makeInheritSa(), 0);
		if (!(go$interfaceIsEqual(e, null))) {
			err = e;
			return err;
		}
		_slice = p, _index = 0, (_index >= 0 && _index < _slice.length) ? (_slice.array[_slice.offset + _index] = r) : go$throwRuntimeError("index out of range");
		_slice$1 = p, _index$1 = 1, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = w) : go$throwRuntimeError("index out of range");
		err = null;
		return err;
	};
	var Utimes = go$pkg.Utimes = function(path, tv) {
		var err, _tuple, pathp, e, _tuple$1, h, _slice, _index, _struct, a, _slice$1, _index$1, _struct$1, w;
		err = null;
		var go$deferred = [];
		try {
			if (!((tv.length === 2))) {
				err = new Errno(536870951);
				return err;
			}
			_tuple = UTF16PtrFromString(path), pathp = _tuple[0], e = _tuple[1];
			if (!(go$interfaceIsEqual(e, null))) {
				err = e;
				return err;
			}
			_tuple$1 = CreateFile(pathp, 256, 2, (go$ptrType(SecurityAttributes)).nil, 3, 128, 0), h = _tuple$1[0], e = _tuple$1[1];
			if (!(go$interfaceIsEqual(e, null))) {
				err = e;
				return err;
			}
			go$deferred.push({ fun: Close, args: [h] });
			a = (_struct = NsecToFiletime((_slice = tv, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")).Nanoseconds()), new Filetime.Ptr(_struct.LowDateTime, _struct.HighDateTime));
			w = (_struct$1 = NsecToFiletime((_slice$1 = tv, _index$1 = 1, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")).Nanoseconds()), new Filetime.Ptr(_struct$1.LowDateTime, _struct$1.HighDateTime));
			err = SetFileTime(h, (go$ptrType(Filetime)).nil, a, w);
			return err;
		} catch(go$err) {
			go$pushErr(go$err);
		} finally {
			go$callDeferred(go$deferred);
			return err;
		}
	};
	var UtimesNano = go$pkg.UtimesNano = function(path, ts) {
		var err, _tuple, pathp, e, _tuple$1, h, _slice, _index, _struct, _struct$1, a, _slice$1, _index$1, _struct$2, _struct$3, w;
		err = null;
		var go$deferred = [];
		try {
			if (!((ts.length === 2))) {
				err = new Errno(536870951);
				return err;
			}
			_tuple = UTF16PtrFromString(path), pathp = _tuple[0], e = _tuple[1];
			if (!(go$interfaceIsEqual(e, null))) {
				err = e;
				return err;
			}
			_tuple$1 = CreateFile(pathp, 256, 2, (go$ptrType(SecurityAttributes)).nil, 3, 128, 0), h = _tuple$1[0], e = _tuple$1[1];
			if (!(go$interfaceIsEqual(e, null))) {
				err = e;
				return err;
			}
			go$deferred.push({ fun: Close, args: [h] });
			a = (_struct$1 = NsecToFiletime(TimespecToNsec((_struct = (_slice = ts, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")), new Timespec.Ptr(_struct.Sec, _struct.Nsec)))), new Filetime.Ptr(_struct$1.LowDateTime, _struct$1.HighDateTime));
			w = (_struct$3 = NsecToFiletime(TimespecToNsec((_struct$2 = (_slice$1 = ts, _index$1 = 1, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")), new Timespec.Ptr(_struct$2.Sec, _struct$2.Nsec)))), new Filetime.Ptr(_struct$3.LowDateTime, _struct$3.HighDateTime));
			err = SetFileTime(h, (go$ptrType(Filetime)).nil, a, w);
			return err;
		} catch(go$err) {
			go$pushErr(go$err);
		} finally {
			go$callDeferred(go$deferred);
			return err;
		}
	};
	var Fsync = go$pkg.Fsync = function(fd) {
		var err;
		err = null;
		err = FlushFileBuffers(fd);
		return err;
	};
	var Chmod = go$pkg.Chmod = function(path, mode) {
		var err, _tuple, p, e, _tuple$1, attrs;
		err = null;
		if (mode === 0) {
			err = new Errno(536870951);
			return err;
		}
		_tuple = UTF16PtrFromString(path), p = _tuple[0], e = _tuple[1];
		if (!(go$interfaceIsEqual(e, null))) {
			err = e;
			return err;
		}
		_tuple$1 = GetFileAttributes(p), attrs = _tuple$1[0], e = _tuple$1[1];
		if (!(go$interfaceIsEqual(e, null))) {
			err = e;
			return err;
		}
		if (!((((mode & 128) >>> 0) === 0))) {
			attrs = attrs & ~1;
		} else {
			attrs = (attrs | 1) >>> 0;
		}
		err = SetFileAttributes(p, attrs);
		return err;
	};
	var LoadCancelIoEx = go$pkg.LoadCancelIoEx = function() {
		return procCancelIoEx.Find();
	};
	var LoadSetFileCompletionNotificationModes = go$pkg.LoadSetFileCompletionNotificationModes = function() {
		return procSetFileCompletionNotificationModes.Find();
	};
	SockaddrInet4.Ptr.prototype.sockaddr = function() {
		var sa, v, p, i, _array, _struct, _view;
		sa = this;
		if (sa.Port < 0 || sa.Port > 65535) {
			return [0, 0, new Errno(536870951)];
		}
		sa.raw.Family = 2;
		p = new (go$ptrType(Go$Uint16))(function() { return sa.raw.Port; }, function(v) { sa.raw.Port = v; });
		p[0] = ((sa.Port >> 8 >> 0) << 24 >>> 24);
		p[1] = (sa.Port << 24 >>> 24);
		i = 0;
		while (i < 4) {
			sa.raw.Addr[i] = sa.Addr[i];
			i = i + 1 >> 0;
		}
		_array = new Uint8Array(16);
		return [_array, 16, null];
	};
	SockaddrInet4.prototype.sockaddr = function() { return this.go$val.sockaddr(); };
	SockaddrInet6.Ptr.prototype.sockaddr = function() {
		var sa, v, p, i, _array, _struct, _view;
		sa = this;
		if (sa.Port < 0 || sa.Port > 65535) {
			return [0, 0, new Errno(536870951)];
		}
		sa.raw.Family = 23;
		p = new (go$ptrType(Go$Uint16))(function() { return sa.raw.Port; }, function(v) { sa.raw.Port = v; });
		p[0] = ((sa.Port >> 8 >> 0) << 24 >>> 24);
		p[1] = (sa.Port << 24 >>> 24);
		sa.raw.Scope_id = sa.ZoneId;
		i = 0;
		while (i < 16) {
			sa.raw.Addr[i] = sa.Addr[i];
			i = i + 1 >> 0;
		}
		_array = new Uint8Array(28);
		return [_array, 28, null];
	};
	SockaddrInet6.prototype.sockaddr = function() { return this.go$val.sockaddr(); };
	SockaddrUnix.Ptr.prototype.sockaddr = function() {
		var sa;
		sa = this;
		return [0, 0, new Errno(536871042)];
	};
	SockaddrUnix.prototype.sockaddr = function() { return this.go$val.sockaddr(); };
	RawSockaddrAny.Ptr.prototype.Sockaddr = function() {
		var rsa, _ref, _array, _struct, _array$1, _struct$1, _view, _view$1, pp, sa, v, p, i, _array$2, _struct$2, _array$3, _struct$3, _view$2, _view$3, pp$1, sa$1, v$1, p$1, i$1;
		rsa = this;
		_ref = rsa.Addr.Family;
		if (_ref === 1) {
			return [null, new Errno(536871042)];
		} else if (_ref === 2) {
			_array$1 = new Uint8Array(112);
			pp = (_array = _array$1, _struct = new RawSockaddrInet4.Ptr(), _view$1 = new DataView(_array.buffer, _array.byteOffset), _struct.Family = _view$1.getUint16(0, true), _struct.Port = _view$1.getUint16(2, true), _struct.Addr = new (go$nativeArray("Uint8"))(_array.buffer, go$min(_array.byteOffset + 4, _array.buffer.byteLength)), _struct.Zero = new (go$nativeArray("Uint8"))(_array.buffer, go$min(_array.byteOffset + 8, _array.buffer.byteLength)), _struct);
			_struct$1 = rsa, _view = new DataView(_array$1.buffer, _array$1.byteOffset), _struct$1.Addr.Family = _view.getUint16(0, true), _struct$1.Addr.Data = new (go$nativeArray("Int8"))(_array$1.buffer, go$min(_array$1.byteOffset + 2, _array$1.buffer.byteLength)), _struct$1.Pad = new (go$nativeArray("Int8"))(_array$1.buffer, go$min(_array$1.byteOffset + 16, _array$1.buffer.byteLength));
			sa = new SockaddrInet4.Ptr();
			p = new (go$ptrType(Go$Uint16))(function() { return pp.Port; }, function(v) { pp.Port = v; });
			sa.Port = ((p[0] >> 0) << 8 >> 0) + (p[1] >> 0) >> 0;
			i = 0;
			while (i < 4) {
				sa.Addr[i] = pp.Addr[i];
				i = i + 1 >> 0;
			}
			return [sa, null];
		} else if (_ref === 23) {
			_array$3 = new Uint8Array(112);
			pp$1 = (_array$2 = _array$3, _struct$2 = new RawSockaddrInet6.Ptr(), _view$3 = new DataView(_array$2.buffer, _array$2.byteOffset), _struct$2.Family = _view$3.getUint16(0, true), _struct$2.Port = _view$3.getUint16(2, true), _struct$2.Flowinfo = _view$3.getUint32(4, true), _struct$2.Addr = new (go$nativeArray("Uint8"))(_array$2.buffer, go$min(_array$2.byteOffset + 8, _array$2.buffer.byteLength)), _struct$2.Scope_id = _view$3.getUint32(24, true), _struct$2);
			_struct$3 = rsa, _view$2 = new DataView(_array$3.buffer, _array$3.byteOffset), _struct$3.Addr.Family = _view$2.getUint16(0, true), _struct$3.Addr.Data = new (go$nativeArray("Int8"))(_array$3.buffer, go$min(_array$3.byteOffset + 2, _array$3.buffer.byteLength)), _struct$3.Pad = new (go$nativeArray("Int8"))(_array$3.buffer, go$min(_array$3.byteOffset + 16, _array$3.buffer.byteLength));
			sa$1 = new SockaddrInet6.Ptr();
			p$1 = new (go$ptrType(Go$Uint16))(function() { return pp$1.Port; }, function(v$1) { pp$1.Port = v$1; });
			sa$1.Port = ((p$1[0] >> 0) << 8 >> 0) + (p$1[1] >> 0) >> 0;
			sa$1.ZoneId = pp$1.Scope_id;
			i$1 = 0;
			while (i$1 < 16) {
				sa$1.Addr[i$1] = pp$1.Addr[i$1];
				i$1 = i$1 + 1 >> 0;
			}
			return [sa$1, null];
		}
		return [null, new Errno(536870917)];
	};
	RawSockaddrAny.prototype.Sockaddr = function() { return this.go$val.Sockaddr(); };
	var Socket = go$pkg.Socket = function(domain, typ, proto) {
		var fd, err, _tuple, _tuple$1;
		fd = 0;
		err = null;
		if ((domain === 23) && go$pkg.SocketDisableIPv6) {
			_tuple = [4294967295, new Errno(536870917)], fd = _tuple[0], err = _tuple[1];
			return [fd, err];
		}
		_tuple$1 = socket((domain >> 0), (typ >> 0), (proto >> 0)), fd = _tuple$1[0], err = _tuple$1[1];
		return [fd, err];
	};
	var SetsockoptInt = go$pkg.SetsockoptInt = function(fd, level, opt, value) {
		var err, v, v$1;
		err = null;
		v = (value >> 0);
		err = Setsockopt(fd, (level >> 0), (opt >> 0), new (go$ptrType(Go$Int32))(function() { return v; }, function(v$1) { v = v$1; }), 4);
		return err;
	};
	var Bind = go$pkg.Bind = function(fd, sa) {
		var err, _tuple, ptr, n;
		err = null;
		_tuple = sa.sockaddr(), ptr = _tuple[0], n = _tuple[1], err = _tuple[2];
		if (!(go$interfaceIsEqual(err, null))) {
			err = err;
			return err;
		}
		err = bind(fd, ptr, n);
		return err;
	};
	var Connect = go$pkg.Connect = function(fd, sa) {
		var err, _tuple, ptr, n;
		err = null;
		_tuple = sa.sockaddr(), ptr = _tuple[0], n = _tuple[1], err = _tuple[2];
		if (!(go$interfaceIsEqual(err, null))) {
			err = err;
			return err;
		}
		err = connect(fd, ptr, n);
		return err;
	};
	var Getsockname = go$pkg.Getsockname = function(fd) {
		var sa, err, rsa, l, v, _tuple;
		sa = null;
		err = null;
		rsa = new RawSockaddrAny.Ptr();
		l = 112;
		if (err = getsockname(fd, rsa, new (go$ptrType(Go$Int32))(function() { return l; }, function(v) { l = v; })), !(go$interfaceIsEqual(err, null))) {
			return [sa, err];
		}
		_tuple = rsa.Sockaddr(), sa = _tuple[0], err = _tuple[1];
		return [sa, err];
	};
	var Getpeername = go$pkg.Getpeername = function(fd) {
		var sa, err, rsa, l, v, _tuple;
		sa = null;
		err = null;
		rsa = new RawSockaddrAny.Ptr();
		l = 112;
		if (err = getpeername(fd, rsa, new (go$ptrType(Go$Int32))(function() { return l; }, function(v) { l = v; })), !(go$interfaceIsEqual(err, null))) {
			return [sa, err];
		}
		_tuple = rsa.Sockaddr(), sa = _tuple[0], err = _tuple[1];
		return [sa, err];
	};
	var Listen = go$pkg.Listen = function(s, n) {
		var err;
		err = null;
		err = listen(s, (n >> 0));
		return err;
	};
	var Shutdown = go$pkg.Shutdown = function(fd, how) {
		var err;
		err = null;
		err = shutdown(fd, (how >> 0));
		return err;
	};
	var WSASendto = go$pkg.WSASendto = function(s, bufs, bufcnt, sent, flags, to, overlapped, croutine) {
		var err, _tuple, rsa, l, _array, _struct, _view;
		err = null;
		_tuple = to.sockaddr(), rsa = _tuple[0], l = _tuple[1], err = _tuple[2];
		if (!(go$interfaceIsEqual(err, null))) {
			err = err;
			return err;
		}
		err = WSASendTo(s, bufs, bufcnt, sent, flags, (_array = rsa, _struct = new RawSockaddrAny.Ptr(), _view = new DataView(_array.buffer, _array.byteOffset), _struct.Addr.Family = _view.getUint16(0, true), _struct.Addr.Data = new (go$nativeArray("Int8"))(_array.buffer, go$min(_array.byteOffset + 2, _array.buffer.byteLength)), _struct.Pad = new (go$nativeArray("Int8"))(_array.buffer, go$min(_array.byteOffset + 16, _array.buffer.byteLength)), _struct), l, overlapped, croutine);
		return err;
	};
	var LoadGetAddrInfo = go$pkg.LoadGetAddrInfo = function() {
		return procGetAddrInfoW.Find();
	};
	var LoadConnectEx = go$pkg.LoadConnectEx = function() {
		connectExFunc.once.Do((function() {
			var s, _tuple, n, _array, _struct, _view, v, v$1;
			var go$deferred = [];
			try {
				s = 0;
				_tuple = Socket(2, 1, 6), s = _tuple[0], connectExFunc.err = _tuple[1];
				if (!(go$interfaceIsEqual(connectExFunc.err, null))) {
					return;
				}
				go$deferred.push({ fun: CloseHandle, args: [s] });
				n = 0;
				_array = new Uint8Array(16);
				connectExFunc.err = WSAIoctl(s, 3355443206, _array, 16, new (go$ptrType(Go$Uintptr))(function() { return connectExFunc.addr; }, function(v) { connectExFunc.addr = v; }), 4, new (go$ptrType(Go$Uint32))(function() { return n; }, function(v$1) { n = v$1; }), (go$ptrType(Overlapped)).nil, 0);
				_struct = go$pkg.WSAID_CONNECTEX, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Data1 = _view.getUint32(0, true), _struct.Data2 = _view.getUint16(4, true), _struct.Data3 = _view.getUint16(6, true), _struct.Data4 = new (go$nativeArray("Uint8"))(_array.buffer, go$min(_array.byteOffset + 8, _array.buffer.byteLength));
			} catch(go$err) {
				go$pushErr(go$err);
			} finally {
				go$callDeferred(go$deferred);
			}
		}));
		return connectExFunc.err;
	};
	var connectEx = function(s, name, namelen, sendBuf, sendDataLen, bytesSent, overlapped) {
		var err, _tuple, _array, _struct, _view, r1, e1;
		err = null;
		_array = new Uint8Array(20);
		_tuple = Syscall9(connectExFunc.addr, 7, (s >>> 0), name, (namelen >>> 0), sendBuf, (sendDataLen >>> 0), bytesSent, _array, 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		_struct = overlapped, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Internal = _view.getUintptr(0, true), _struct.InternalHigh = _view.getUintptr(4, true), _struct.Offset = _view.getUint32(8, true), _struct.OffsetHigh = _view.getUint32(12, true), _struct.HEvent = _view.getUintptr(16, true);
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var ConnectEx = go$pkg.ConnectEx = function(fd, sa, sendBuf, sendDataLen, bytesSent, overlapped) {
		var err, _tuple, ptr, n;
		err = LoadConnectEx();
		if (!(go$interfaceIsEqual(err, null))) {
			return errors$1.New("failed to find ConnectEx: " + err.Error());
		}
		_tuple = sa.sockaddr(), ptr = _tuple[0], n = _tuple[1], err = _tuple[2];
		if (!(go$interfaceIsEqual(err, null))) {
			return err;
		}
		return connectEx(fd, ptr, n, sendBuf, sendDataLen, bytesSent, overlapped);
	};
	WaitStatus.Ptr.prototype.Exited = function() {
		var _struct, w;
		w = (_struct = this, new WaitStatus.Ptr(_struct.ExitCode));
		return true;
	};
	WaitStatus.prototype.Exited = function() { return this.go$val.Exited(); };
	WaitStatus.Ptr.prototype.ExitStatus = function() {
		var _struct, w;
		w = (_struct = this, new WaitStatus.Ptr(_struct.ExitCode));
		return (w.ExitCode >> 0);
	};
	WaitStatus.prototype.ExitStatus = function() { return this.go$val.ExitStatus(); };
	WaitStatus.Ptr.prototype.Signal = function() {
		var _struct, w;
		w = (_struct = this, new WaitStatus.Ptr(_struct.ExitCode));
		return -1;
	};
	WaitStatus.prototype.Signal = function() { return this.go$val.Signal(); };
	WaitStatus.Ptr.prototype.CoreDump = function() {
		var _struct, w;
		w = (_struct = this, new WaitStatus.Ptr(_struct.ExitCode));
		return false;
	};
	WaitStatus.prototype.CoreDump = function() { return this.go$val.CoreDump(); };
	WaitStatus.Ptr.prototype.Stopped = function() {
		var _struct, w;
		w = (_struct = this, new WaitStatus.Ptr(_struct.ExitCode));
		return false;
	};
	WaitStatus.prototype.Stopped = function() { return this.go$val.Stopped(); };
	WaitStatus.Ptr.prototype.Continued = function() {
		var _struct, w;
		w = (_struct = this, new WaitStatus.Ptr(_struct.ExitCode));
		return false;
	};
	WaitStatus.prototype.Continued = function() { return this.go$val.Continued(); };
	WaitStatus.Ptr.prototype.StopSignal = function() {
		var _struct, w;
		w = (_struct = this, new WaitStatus.Ptr(_struct.ExitCode));
		return -1;
	};
	WaitStatus.prototype.StopSignal = function() { return this.go$val.StopSignal(); };
	WaitStatus.Ptr.prototype.Signaled = function() {
		var _struct, w;
		w = (_struct = this, new WaitStatus.Ptr(_struct.ExitCode));
		return false;
	};
	WaitStatus.prototype.Signaled = function() { return this.go$val.Signaled(); };
	WaitStatus.Ptr.prototype.TrapCause = function() {
		var _struct, w;
		w = (_struct = this, new WaitStatus.Ptr(_struct.ExitCode));
		return -1;
	};
	WaitStatus.prototype.TrapCause = function() { return this.go$val.TrapCause(); };
	var TimespecToNsec = go$pkg.TimespecToNsec = function(ts) {
		var x, x$1;
		return (x = go$mul64(ts.Sec, new Go$Int64(0, 1000000000)), x$1 = ts.Nsec, new Go$Int64(x.high + x$1.high, x.low + x$1.low));
	};
	var NsecToTimespec = go$pkg.NsecToTimespec = function(nsec) {
		var ts, _struct;
		ts = new Timespec.Ptr();
		ts.Sec = go$div64(nsec, new Go$Int64(0, 1000000000), false);
		ts.Nsec = go$div64(nsec, new Go$Int64(0, 1000000000), true);
		return (_struct = ts, new Timespec.Ptr(_struct.Sec, _struct.Nsec));
	};
	var Accept = go$pkg.Accept = function(fd) {
		var nfd, sa, err, _tuple;
		nfd = 0;
		sa = null;
		err = null;
		_tuple = [0, null, new Errno(536871042)], nfd = _tuple[0], sa = _tuple[1], err = _tuple[2];
		return [nfd, sa, err];
	};
	var Recvfrom = go$pkg.Recvfrom = function(fd, p, flags) {
		var n, from, err, _tuple;
		n = 0;
		from = null;
		err = null;
		_tuple = [0, null, new Errno(536871042)], n = _tuple[0], from = _tuple[1], err = _tuple[2];
		return [n, from, err];
	};
	var Sendto = go$pkg.Sendto = function(fd, p, flags, to) {
		var err;
		err = null;
		err = new Errno(536871042);
		return err;
	};
	var SetsockoptTimeval = go$pkg.SetsockoptTimeval = function(fd, level, opt, tv) {
		var err;
		err = null;
		err = new Errno(536871042);
		return err;
	};
	var GetsockoptInt = go$pkg.GetsockoptInt = function(fd, level, opt) {
		return [-1, new Errno(536871042)];
	};
	var SetsockoptLinger = go$pkg.SetsockoptLinger = function(fd, level, opt, l) {
		var err, sys, _array, _struct, _view;
		err = null;
		sys = new sysLinger.Ptr((l.Onoff << 16 >>> 16), (l.Linger << 16 >>> 16));
		_array = new Uint8Array(4);
		err = Setsockopt(fd, (level >> 0), (opt >> 0), _array, 4);
		_struct = sys, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Onoff = _view.getUint16(0, true), _struct.Linger = _view.getUint16(2, true);
		return err;
	};
	var SetsockoptInet4Addr = go$pkg.SetsockoptInet4Addr = function(fd, level, opt, value) {
		var err;
		err = null;
		err = Setsockopt(fd, (level >> 0), (opt >> 0), go$sliceToArray(new (go$sliceType(Go$Uint8))(value)), 4);
		return err;
	};
	var SetsockoptIPMreq = go$pkg.SetsockoptIPMreq = function(fd, level, opt, mreq) {
		var err, _array, _struct, _view;
		err = null;
		_array = new Uint8Array(8);
		err = Setsockopt(fd, (level >> 0), (opt >> 0), _array, 8);
		_struct = mreq, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Multiaddr = new (go$nativeArray("Uint8"))(_array.buffer, go$min(_array.byteOffset + 0, _array.buffer.byteLength)), _struct.Interface = new (go$nativeArray("Uint8"))(_array.buffer, go$min(_array.byteOffset + 4, _array.buffer.byteLength));
		return err;
	};
	var SetsockoptIPv6Mreq = go$pkg.SetsockoptIPv6Mreq = function(fd, level, opt, mreq) {
		var err;
		err = null;
		err = new Errno(536871042);
		return err;
	};
	var Getpid = go$pkg.Getpid = function() {
		var pid;
		pid = 0;
		pid = (getCurrentProcessId() >> 0);
		return pid;
	};
	var FindFirstFile = go$pkg.FindFirstFile = function(name, data) {
		var handle, err, data1, _tuple;
		handle = 0;
		err = null;
		data1 = new win32finddata1.Ptr();
		_tuple = findFirstFile1(name, data1), handle = _tuple[0], err = _tuple[1];
		if (go$interfaceIsEqual(err, null)) {
			copyFindData(data, data1);
		}
		return [handle, err];
	};
	var FindNextFile = go$pkg.FindNextFile = function(handle, data) {
		var err, data1;
		err = null;
		data1 = new win32finddata1.Ptr();
		err = findNextFile1(handle, data1);
		if (go$interfaceIsEqual(err, null)) {
			copyFindData(data, data1);
		}
		return err;
	};
	var Getppid = go$pkg.Getppid = function() {
		var ppid;
		ppid = 0;
		ppid = -1;
		return ppid;
	};
	var Fchdir = go$pkg.Fchdir = function(fd) {
		var err;
		err = null;
		err = new Errno(536871042);
		return err;
	};
	var Link = go$pkg.Link = function(oldpath, newpath) {
		var err;
		err = null;
		err = new Errno(536871042);
		return err;
	};
	var Symlink = go$pkg.Symlink = function(path, link) {
		var err;
		err = null;
		err = new Errno(536871042);
		return err;
	};
	var Readlink = go$pkg.Readlink = function(path, buf) {
		var n, err, _tuple;
		n = 0;
		err = null;
		_tuple = [0, new Errno(536871042)], n = _tuple[0], err = _tuple[1];
		return [n, err];
	};
	var Fchmod = go$pkg.Fchmod = function(fd, mode) {
		var err;
		err = null;
		err = new Errno(536871042);
		return err;
	};
	var Chown = go$pkg.Chown = function(path, uid, gid) {
		var err;
		err = null;
		err = new Errno(536871042);
		return err;
	};
	var Lchown = go$pkg.Lchown = function(path, uid, gid) {
		var err;
		err = null;
		err = new Errno(536871042);
		return err;
	};
	var Fchown = go$pkg.Fchown = function(fd, uid, gid) {
		var err;
		err = null;
		err = new Errno(536871042);
		return err;
	};
	var Getuid = go$pkg.Getuid = function() {
		var uid;
		uid = 0;
		uid = -1;
		return uid;
	};
	var Geteuid = go$pkg.Geteuid = function() {
		var euid;
		euid = 0;
		euid = -1;
		return euid;
	};
	var Getgid = go$pkg.Getgid = function() {
		var gid;
		gid = 0;
		gid = -1;
		return gid;
	};
	var Getegid = go$pkg.Getegid = function() {
		var egid;
		egid = 0;
		egid = -1;
		return egid;
	};
	var Getgroups = go$pkg.Getgroups = function() {
		var gids, err, _tuple;
		gids = (go$sliceType(Go$Int)).nil;
		err = null;
		_tuple = [(go$sliceType(Go$Int)).nil, new Errno(536871042)], gids = _tuple[0], err = _tuple[1];
		return [gids, err];
	};
	Signal.prototype.Signal = function() {
		var s;
		s = this.go$val;
	};
	go$ptrType(Signal).prototype.Signal = function() { return new Signal(this.go$get()).Signal(); };
	Signal.prototype.String = function() {
		var s, str;
		s = this.go$val;
		if (0 <= s && (s >> 0) < 16) {
			str = signals[s];
			if (!(str === "")) {
				return str;
			}
		}
		return "signal " + itoa((s >> 0));
	};
	go$ptrType(Signal).prototype.String = function() { return new Signal(this.go$get()).String(); };
	var GetLastError = go$pkg.GetLastError = function() {
		var lasterr, _tuple, r0;
		lasterr = null;
		_tuple = Syscall(procGetLastError.Addr(), 0, 0, 0, 0), r0 = _tuple[0];
		if (!((r0 === 0))) {
			lasterr = new Errno((r0 >>> 0));
		}
		return lasterr;
	};
	var LoadLibrary = go$pkg.LoadLibrary = function(libname) {
		var handle, err, _p0, _tuple, _tuple$1, r0, e1;
		handle = 0;
		err = null;
		_p0 = (go$ptrType(Go$Uint16)).nil;
		_tuple = UTF16PtrFromString(libname), _p0 = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			return [handle, err];
		}
		_tuple$1 = Syscall(procLoadLibraryW.Addr(), 1, _p0, 0, 0), r0 = _tuple$1[0], e1 = _tuple$1[2];
		handle = (r0 >>> 0);
		if (handle === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [handle, err];
	};
	var FreeLibrary = go$pkg.FreeLibrary = function(handle) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procFreeLibrary.Addr(), 1, (handle >>> 0), 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var GetProcAddress = go$pkg.GetProcAddress = function(module, procname) {
		var proc, err, _p0, _tuple, _tuple$1, r0, e1;
		proc = 0;
		err = null;
		_p0 = (go$ptrType(Go$Uint8)).nil;
		_tuple = BytePtrFromString(procname), _p0 = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			return [proc, err];
		}
		_tuple$1 = Syscall(procGetProcAddress.Addr(), 2, (module >>> 0), _p0, 0), r0 = _tuple$1[0], e1 = _tuple$1[2];
		proc = r0;
		if (proc === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [proc, err];
	};
	var GetVersion = go$pkg.GetVersion = function() {
		var ver, err, _tuple, r0, e1;
		ver = 0;
		err = null;
		_tuple = Syscall(procGetVersion.Addr(), 0, 0, 0, 0), r0 = _tuple[0], e1 = _tuple[2];
		ver = (r0 >>> 0);
		if (ver === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [ver, err];
	};
	var FormatMessage = go$pkg.FormatMessage = function(flags, msgsrc, msgid, langid$1, buf, args) {
		var n, err, _p0, v, _slice, _index, _slice$1, _index$1, _tuple, r0, e1;
		n = 0;
		err = null;
		_p0 = (go$ptrType(Go$Uint16)).nil;
		if (buf.length > 0) {
			_p0 = new (go$ptrType(Go$Uint16))(function() { return (_slice = buf, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")); }, function(v) { _slice$1 = buf, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = v) : go$throwRuntimeError("index out of range"); });
		}
		_tuple = Syscall9(procFormatMessageW.Addr(), 7, (flags >>> 0), (msgsrc >>> 0), (msgid >>> 0), (langid$1 >>> 0), _p0, (buf.length >>> 0), args, 0, 0), r0 = _tuple[0], e1 = _tuple[2];
		n = (r0 >>> 0);
		if (n === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [n, err];
	};
	var ExitProcess = go$pkg.ExitProcess = function(exitcode) {
		Syscall(procExitProcess.Addr(), 1, (exitcode >>> 0), 0, 0);
		return;
	};
	var CreateFile = go$pkg.CreateFile = function(name, access, mode, sa, createmode, attrs, templatefile) {
		var handle, err, _tuple, _array, _struct, _view, r0, e1;
		handle = 0;
		err = null;
		_array = new Uint8Array(12);
		_tuple = Syscall9(procCreateFileW.Addr(), 7, name, (access >>> 0), (mode >>> 0), _array, (createmode >>> 0), (attrs >>> 0), (templatefile >>> 0), 0, 0), r0 = _tuple[0], e1 = _tuple[2];
		_struct = sa, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Length = _view.getUint32(0, true), _struct.SecurityDescriptor = _view.getUintptr(4, true), _struct.InheritHandle = _view.getUint32(8, true);
		handle = (r0 >>> 0);
		if (handle === 4294967295) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [handle, err];
	};
	var ReadFile = go$pkg.ReadFile = function(handle, buf, done, overlapped) {
		var err, _p0, v, _slice, _index, _slice$1, _index$1, _tuple, _array, _struct, _view, r1, e1;
		err = null;
		_p0 = (go$ptrType(Go$Uint8)).nil;
		if (buf.length > 0) {
			_p0 = new (go$ptrType(Go$Uint8))(function() { return (_slice = buf, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")); }, function(v) { _slice$1 = buf, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = v) : go$throwRuntimeError("index out of range"); });
		}
		_array = new Uint8Array(20);
		_tuple = Syscall6(procReadFile.Addr(), 5, (handle >>> 0), _p0, (buf.length >>> 0), done, _array, 0), r1 = _tuple[0], e1 = _tuple[2];
		_struct = overlapped, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Internal = _view.getUintptr(0, true), _struct.InternalHigh = _view.getUintptr(4, true), _struct.Offset = _view.getUint32(8, true), _struct.OffsetHigh = _view.getUint32(12, true), _struct.HEvent = _view.getUintptr(16, true);
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var WriteFile = go$pkg.WriteFile = function(handle, buf, done, overlapped) {
		var err, _p0, v, _slice, _index, _slice$1, _index$1, _tuple, _array, _struct, _view, r1, e1;
		err = null;
		_p0 = (go$ptrType(Go$Uint8)).nil;
		if (buf.length > 0) {
			_p0 = new (go$ptrType(Go$Uint8))(function() { return (_slice = buf, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")); }, function(v) { _slice$1 = buf, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = v) : go$throwRuntimeError("index out of range"); });
		}
		_array = new Uint8Array(20);
		_tuple = Syscall6(procWriteFile.Addr(), 5, (handle >>> 0), _p0, (buf.length >>> 0), done, _array, 0), r1 = _tuple[0], e1 = _tuple[2];
		_struct = overlapped, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Internal = _view.getUintptr(0, true), _struct.InternalHigh = _view.getUintptr(4, true), _struct.Offset = _view.getUint32(8, true), _struct.OffsetHigh = _view.getUint32(12, true), _struct.HEvent = _view.getUintptr(16, true);
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var SetFilePointer = go$pkg.SetFilePointer = function(handle, lowoffset, highoffsetptr, whence) {
		var newlowoffset, err, _tuple, r0, e1;
		newlowoffset = 0;
		err = null;
		_tuple = Syscall6(procSetFilePointer.Addr(), 4, (handle >>> 0), (lowoffset >>> 0), highoffsetptr, (whence >>> 0), 0, 0), r0 = _tuple[0], e1 = _tuple[2];
		newlowoffset = (r0 >>> 0);
		if (newlowoffset === 4294967295) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [newlowoffset, err];
	};
	var CloseHandle = go$pkg.CloseHandle = function(handle) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procCloseHandle.Addr(), 1, (handle >>> 0), 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var GetStdHandle = go$pkg.GetStdHandle = function(stdhandle) {
		var handle, err, _tuple, r0, e1;
		handle = 0;
		err = null;
		_tuple = Syscall(procGetStdHandle.Addr(), 1, (stdhandle >>> 0), 0, 0), r0 = _tuple[0], e1 = _tuple[2];
		handle = (r0 >>> 0);
		if (handle === 4294967295) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [handle, err];
	};
	var findFirstFile1 = function(name, data) {
		var handle, err, _tuple, _array, _struct, _view, r0, e1;
		handle = 0;
		err = null;
		_array = new Uint8Array(592);
		_tuple = Syscall(procFindFirstFileW.Addr(), 2, name, _array, 0), r0 = _tuple[0], e1 = _tuple[2];
		_struct = data, _view = new DataView(_array.buffer, _array.byteOffset), _struct.FileAttributes = _view.getUint32(0, true), _struct.CreationTime.LowDateTime = _view.getUint32(4, true), _struct.CreationTime.HighDateTime = _view.getUint32(8, true), _struct.LastAccessTime.LowDateTime = _view.getUint32(12, true), _struct.LastAccessTime.HighDateTime = _view.getUint32(16, true), _struct.LastWriteTime.LowDateTime = _view.getUint32(20, true), _struct.LastWriteTime.HighDateTime = _view.getUint32(24, true), _struct.FileSizeHigh = _view.getUint32(28, true), _struct.FileSizeLow = _view.getUint32(32, true), _struct.Reserved0 = _view.getUint32(36, true), _struct.Reserved1 = _view.getUint32(40, true), _struct.FileName = new (go$nativeArray("Uint16"))(_array.buffer, go$min(_array.byteOffset + 44, _array.buffer.byteLength)), _struct.AlternateFileName = new (go$nativeArray("Uint16"))(_array.buffer, go$min(_array.byteOffset + 564, _array.buffer.byteLength));
		handle = (r0 >>> 0);
		if (handle === 4294967295) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [handle, err];
	};
	var findNextFile1 = function(handle, data) {
		var err, _tuple, _array, _struct, _view, r1, e1;
		err = null;
		_array = new Uint8Array(592);
		_tuple = Syscall(procFindNextFileW.Addr(), 2, (handle >>> 0), _array, 0), r1 = _tuple[0], e1 = _tuple[2];
		_struct = data, _view = new DataView(_array.buffer, _array.byteOffset), _struct.FileAttributes = _view.getUint32(0, true), _struct.CreationTime.LowDateTime = _view.getUint32(4, true), _struct.CreationTime.HighDateTime = _view.getUint32(8, true), _struct.LastAccessTime.LowDateTime = _view.getUint32(12, true), _struct.LastAccessTime.HighDateTime = _view.getUint32(16, true), _struct.LastWriteTime.LowDateTime = _view.getUint32(20, true), _struct.LastWriteTime.HighDateTime = _view.getUint32(24, true), _struct.FileSizeHigh = _view.getUint32(28, true), _struct.FileSizeLow = _view.getUint32(32, true), _struct.Reserved0 = _view.getUint32(36, true), _struct.Reserved1 = _view.getUint32(40, true), _struct.FileName = new (go$nativeArray("Uint16"))(_array.buffer, go$min(_array.byteOffset + 44, _array.buffer.byteLength)), _struct.AlternateFileName = new (go$nativeArray("Uint16"))(_array.buffer, go$min(_array.byteOffset + 564, _array.buffer.byteLength));
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var FindClose = go$pkg.FindClose = function(handle) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procFindClose.Addr(), 1, (handle >>> 0), 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var GetFileInformationByHandle = go$pkg.GetFileInformationByHandle = function(handle, data) {
		var err, _tuple, _array, _struct, _view, r1, e1;
		err = null;
		_array = new Uint8Array(52);
		_tuple = Syscall(procGetFileInformationByHandle.Addr(), 2, (handle >>> 0), _array, 0), r1 = _tuple[0], e1 = _tuple[2];
		_struct = data, _view = new DataView(_array.buffer, _array.byteOffset), _struct.FileAttributes = _view.getUint32(0, true), _struct.CreationTime.LowDateTime = _view.getUint32(4, true), _struct.CreationTime.HighDateTime = _view.getUint32(8, true), _struct.LastAccessTime.LowDateTime = _view.getUint32(12, true), _struct.LastAccessTime.HighDateTime = _view.getUint32(16, true), _struct.LastWriteTime.LowDateTime = _view.getUint32(20, true), _struct.LastWriteTime.HighDateTime = _view.getUint32(24, true), _struct.VolumeSerialNumber = _view.getUint32(28, true), _struct.FileSizeHigh = _view.getUint32(32, true), _struct.FileSizeLow = _view.getUint32(36, true), _struct.NumberOfLinks = _view.getUint32(40, true), _struct.FileIndexHigh = _view.getUint32(44, true), _struct.FileIndexLow = _view.getUint32(48, true);
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var GetCurrentDirectory = go$pkg.GetCurrentDirectory = function(buflen, buf) {
		var n, err, _tuple, r0, e1;
		n = 0;
		err = null;
		_tuple = Syscall(procGetCurrentDirectoryW.Addr(), 2, (buflen >>> 0), buf, 0), r0 = _tuple[0], e1 = _tuple[2];
		n = (r0 >>> 0);
		if (n === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [n, err];
	};
	var SetCurrentDirectory = go$pkg.SetCurrentDirectory = function(path) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procSetCurrentDirectoryW.Addr(), 1, path, 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var CreateDirectory = go$pkg.CreateDirectory = function(path, sa) {
		var err, _tuple, _array, _struct, _view, r1, e1;
		err = null;
		_array = new Uint8Array(12);
		_tuple = Syscall(procCreateDirectoryW.Addr(), 2, path, _array, 0), r1 = _tuple[0], e1 = _tuple[2];
		_struct = sa, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Length = _view.getUint32(0, true), _struct.SecurityDescriptor = _view.getUintptr(4, true), _struct.InheritHandle = _view.getUint32(8, true);
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var RemoveDirectory = go$pkg.RemoveDirectory = function(path) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procRemoveDirectoryW.Addr(), 1, path, 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var DeleteFile = go$pkg.DeleteFile = function(path) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procDeleteFileW.Addr(), 1, path, 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var MoveFile = go$pkg.MoveFile = function(from, to) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procMoveFileW.Addr(), 2, from, to, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var GetComputerName = go$pkg.GetComputerName = function(buf, n) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procGetComputerNameW.Addr(), 2, buf, n, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var SetEndOfFile = go$pkg.SetEndOfFile = function(handle) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procSetEndOfFile.Addr(), 1, (handle >>> 0), 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var GetSystemTimeAsFileTime = go$pkg.GetSystemTimeAsFileTime = function(time) {
		var _array, _struct, _view;
		_array = new Uint8Array(8);
		Syscall(procGetSystemTimeAsFileTime.Addr(), 1, _array, 0, 0);
		_struct = time, _view = new DataView(_array.buffer, _array.byteOffset), _struct.LowDateTime = _view.getUint32(0, true), _struct.HighDateTime = _view.getUint32(4, true);
		return;
	};
	var GetTimeZoneInformation = go$pkg.GetTimeZoneInformation = function(tzi) {
		var rc, err, _tuple, _array, _struct, _view, r0, e1;
		rc = 0;
		err = null;
		_array = new Uint8Array(172);
		_tuple = Syscall(procGetTimeZoneInformation.Addr(), 1, _array, 0, 0), r0 = _tuple[0], e1 = _tuple[2];
		_struct = tzi, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Bias = _view.getInt32(0, true), _struct.StandardName = new (go$nativeArray("Uint16"))(_array.buffer, go$min(_array.byteOffset + 4, _array.buffer.byteLength)), _struct.StandardDate.Year = _view.getUint16(68, true), _struct.StandardDate.Month = _view.getUint16(70, true), _struct.StandardDate.DayOfWeek = _view.getUint16(72, true), _struct.StandardDate.Day = _view.getUint16(74, true), _struct.StandardDate.Hour = _view.getUint16(76, true), _struct.StandardDate.Minute = _view.getUint16(78, true), _struct.StandardDate.Second = _view.getUint16(80, true), _struct.StandardDate.Milliseconds = _view.getUint16(82, true), _struct.StandardBias = _view.getInt32(84, true), _struct.DaylightName = new (go$nativeArray("Uint16"))(_array.buffer, go$min(_array.byteOffset + 88, _array.buffer.byteLength)), _struct.DaylightDate.Year = _view.getUint16(152, true), _struct.DaylightDate.Month = _view.getUint16(154, true), _struct.DaylightDate.DayOfWeek = _view.getUint16(156, true), _struct.DaylightDate.Day = _view.getUint16(158, true), _struct.DaylightDate.Hour = _view.getUint16(160, true), _struct.DaylightDate.Minute = _view.getUint16(162, true), _struct.DaylightDate.Second = _view.getUint16(164, true), _struct.DaylightDate.Milliseconds = _view.getUint16(166, true), _struct.DaylightBias = _view.getInt32(168, true);
		rc = (r0 >>> 0);
		if (rc === 4294967295) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [rc, err];
	};
	var CreateIoCompletionPort = go$pkg.CreateIoCompletionPort = function(filehandle, cphandle, key, threadcnt) {
		var handle, err, _tuple, r0, e1;
		handle = 0;
		err = null;
		_tuple = Syscall6(procCreateIoCompletionPort.Addr(), 4, (filehandle >>> 0), (cphandle >>> 0), (key >>> 0), (threadcnt >>> 0), 0, 0), r0 = _tuple[0], e1 = _tuple[2];
		handle = (r0 >>> 0);
		if (handle === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [handle, err];
	};
	var GetQueuedCompletionStatus = go$pkg.GetQueuedCompletionStatus = function(cphandle, qty, key, overlapped, timeout) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall6(procGetQueuedCompletionStatus.Addr(), 5, (cphandle >>> 0), qty, key, overlapped, (timeout >>> 0), 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var PostQueuedCompletionStatus = go$pkg.PostQueuedCompletionStatus = function(cphandle, qty, key, overlapped) {
		var err, _tuple, _array, _struct, _view, r1, e1;
		err = null;
		_array = new Uint8Array(20);
		_tuple = Syscall6(procPostQueuedCompletionStatus.Addr(), 4, (cphandle >>> 0), (qty >>> 0), (key >>> 0), _array, 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		_struct = overlapped, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Internal = _view.getUintptr(0, true), _struct.InternalHigh = _view.getUintptr(4, true), _struct.Offset = _view.getUint32(8, true), _struct.OffsetHigh = _view.getUint32(12, true), _struct.HEvent = _view.getUintptr(16, true);
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var CancelIo = go$pkg.CancelIo = function(s) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procCancelIo.Addr(), 1, (s >>> 0), 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var CancelIoEx = go$pkg.CancelIoEx = function(s, o) {
		var err, _tuple, _array, _struct, _view, r1, e1;
		err = null;
		_array = new Uint8Array(20);
		_tuple = Syscall(procCancelIoEx.Addr(), 2, (s >>> 0), _array, 0), r1 = _tuple[0], e1 = _tuple[2];
		_struct = o, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Internal = _view.getUintptr(0, true), _struct.InternalHigh = _view.getUintptr(4, true), _struct.Offset = _view.getUint32(8, true), _struct.OffsetHigh = _view.getUint32(12, true), _struct.HEvent = _view.getUintptr(16, true);
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var CreateProcess = go$pkg.CreateProcess = function(appName, commandLine, procSecurity, threadSecurity, inheritHandles, creationFlags, env, currentDir, startupInfo, outProcInfo) {
		var err, _p0, _tuple, _array, _struct, _view, _array$1, _struct$1, _view$1, _array$2, _struct$2, _view$2, _array$3, _struct$3, _view$3, r1, e1;
		err = null;
		_p0 = 0;
		if (inheritHandles) {
			_p0 = 1;
		} else {
			_p0 = 0;
		}
		_array = new Uint8Array(12);
		_array$1 = new Uint8Array(12);
		_struct = procSecurity, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Length = _view.getUint32(0, true), _struct.SecurityDescriptor = _view.getUintptr(4, true), _struct.InheritHandle = _view.getUint32(8, true);
		_array$2 = new Uint8Array(68);
		_struct$1 = threadSecurity, _view$1 = new DataView(_array$1.buffer, _array$1.byteOffset), _struct$1.Length = _view$1.getUint32(0, true), _struct$1.SecurityDescriptor = _view$1.getUintptr(4, true), _struct$1.InheritHandle = _view$1.getUint32(8, true);
		_array$3 = new Uint8Array(16);
		_struct$2 = startupInfo, _view$2 = new DataView(_array$2.buffer, _array$2.byteOffset), _struct$2.Cb = _view$2.getUint32(0, true), _struct$2.X = _view$2.getUint32(16, true), _struct$2.Y = _view$2.getUint32(20, true), _struct$2.XSize = _view$2.getUint32(24, true), _struct$2.YSize = _view$2.getUint32(28, true), _struct$2.XCountChars = _view$2.getUint32(32, true), _struct$2.YCountChars = _view$2.getUint32(36, true), _struct$2.FillAttribute = _view$2.getUint32(40, true), _struct$2.Flags = _view$2.getUint32(44, true), _struct$2.ShowWindow = _view$2.getUint16(48, true), _struct$2._$13 = _view$2.getUint16(50, true), _struct$2.StdInput = _view$2.getUintptr(56, true), _struct$2.StdOutput = _view$2.getUintptr(60, true), _struct$2.StdErr = _view$2.getUintptr(64, true);
		_tuple = Syscall12(procCreateProcessW.Addr(), 10, appName, commandLine, _array, _array$1, (_p0 >>> 0), (creationFlags >>> 0), env, currentDir, _array$2, _array$3, 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		_struct$3 = outProcInfo, _view$3 = new DataView(_array$3.buffer, _array$3.byteOffset), _struct$3.Process = _view$3.getUintptr(0, true), _struct$3.Thread = _view$3.getUintptr(4, true), _struct$3.ProcessId = _view$3.getUint32(8, true), _struct$3.ThreadId = _view$3.getUint32(12, true);
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var OpenProcess = go$pkg.OpenProcess = function(da, inheritHandle, pid) {
		var handle, err, _p0, _tuple, r0, e1;
		handle = 0;
		err = null;
		_p0 = 0;
		if (inheritHandle) {
			_p0 = 1;
		} else {
			_p0 = 0;
		}
		_tuple = Syscall(procOpenProcess.Addr(), 3, (da >>> 0), (_p0 >>> 0), (pid >>> 0)), r0 = _tuple[0], e1 = _tuple[2];
		handle = (r0 >>> 0);
		if (handle === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [handle, err];
	};
	var TerminateProcess = go$pkg.TerminateProcess = function(handle, exitcode) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procTerminateProcess.Addr(), 2, (handle >>> 0), (exitcode >>> 0), 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var GetExitCodeProcess = go$pkg.GetExitCodeProcess = function(handle, exitcode) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procGetExitCodeProcess.Addr(), 2, (handle >>> 0), exitcode, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var GetStartupInfo = go$pkg.GetStartupInfo = function(startupInfo) {
		var err, _tuple, _array, _struct, _view, r1, e1;
		err = null;
		_array = new Uint8Array(68);
		_tuple = Syscall(procGetStartupInfoW.Addr(), 1, _array, 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		_struct = startupInfo, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Cb = _view.getUint32(0, true), _struct.X = _view.getUint32(16, true), _struct.Y = _view.getUint32(20, true), _struct.XSize = _view.getUint32(24, true), _struct.YSize = _view.getUint32(28, true), _struct.XCountChars = _view.getUint32(32, true), _struct.YCountChars = _view.getUint32(36, true), _struct.FillAttribute = _view.getUint32(40, true), _struct.Flags = _view.getUint32(44, true), _struct.ShowWindow = _view.getUint16(48, true), _struct._$13 = _view.getUint16(50, true), _struct.StdInput = _view.getUintptr(56, true), _struct.StdOutput = _view.getUintptr(60, true), _struct.StdErr = _view.getUintptr(64, true);
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var GetCurrentProcess = go$pkg.GetCurrentProcess = function() {
		var pseudoHandle, err, _tuple, r0, e1;
		pseudoHandle = 0;
		err = null;
		_tuple = Syscall(procGetCurrentProcess.Addr(), 0, 0, 0, 0), r0 = _tuple[0], e1 = _tuple[2];
		pseudoHandle = (r0 >>> 0);
		if (pseudoHandle === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [pseudoHandle, err];
	};
	var GetProcessTimes = go$pkg.GetProcessTimes = function(handle, creationTime, exitTime, kernelTime, userTime) {
		var err, _tuple, _array, _struct, _view, _array$1, _struct$1, _view$1, _array$2, _struct$2, _view$2, _array$3, _struct$3, _view$3, r1, e1;
		err = null;
		_array = new Uint8Array(8);
		_array$1 = new Uint8Array(8);
		_struct = creationTime, _view = new DataView(_array.buffer, _array.byteOffset), _struct.LowDateTime = _view.getUint32(0, true), _struct.HighDateTime = _view.getUint32(4, true);
		_array$2 = new Uint8Array(8);
		_struct$1 = exitTime, _view$1 = new DataView(_array$1.buffer, _array$1.byteOffset), _struct$1.LowDateTime = _view$1.getUint32(0, true), _struct$1.HighDateTime = _view$1.getUint32(4, true);
		_array$3 = new Uint8Array(8);
		_struct$2 = kernelTime, _view$2 = new DataView(_array$2.buffer, _array$2.byteOffset), _struct$2.LowDateTime = _view$2.getUint32(0, true), _struct$2.HighDateTime = _view$2.getUint32(4, true);
		_tuple = Syscall6(procGetProcessTimes.Addr(), 5, (handle >>> 0), _array, _array$1, _array$2, _array$3, 0), r1 = _tuple[0], e1 = _tuple[2];
		_struct$3 = userTime, _view$3 = new DataView(_array$3.buffer, _array$3.byteOffset), _struct$3.LowDateTime = _view$3.getUint32(0, true), _struct$3.HighDateTime = _view$3.getUint32(4, true);
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var DuplicateHandle = go$pkg.DuplicateHandle = function(hSourceProcessHandle, hSourceHandle, hTargetProcessHandle, lpTargetHandle, dwDesiredAccess, bInheritHandle, dwOptions) {
		var err, _p0, _tuple, r1, e1;
		err = null;
		_p0 = 0;
		if (bInheritHandle) {
			_p0 = 1;
		} else {
			_p0 = 0;
		}
		_tuple = Syscall9(procDuplicateHandle.Addr(), 7, (hSourceProcessHandle >>> 0), (hSourceHandle >>> 0), (hTargetProcessHandle >>> 0), lpTargetHandle, (dwDesiredAccess >>> 0), (_p0 >>> 0), (dwOptions >>> 0), 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var WaitForSingleObject = go$pkg.WaitForSingleObject = function(handle, waitMilliseconds) {
		var event, err, _tuple, r0, e1;
		event = 0;
		err = null;
		_tuple = Syscall(procWaitForSingleObject.Addr(), 2, (handle >>> 0), (waitMilliseconds >>> 0), 0), r0 = _tuple[0], e1 = _tuple[2];
		event = (r0 >>> 0);
		if (event === 4294967295) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [event, err];
	};
	var GetTempPath = go$pkg.GetTempPath = function(buflen, buf) {
		var n, err, _tuple, r0, e1;
		n = 0;
		err = null;
		_tuple = Syscall(procGetTempPathW.Addr(), 2, (buflen >>> 0), buf, 0), r0 = _tuple[0], e1 = _tuple[2];
		n = (r0 >>> 0);
		if (n === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [n, err];
	};
	var CreatePipe = go$pkg.CreatePipe = function(readhandle, writehandle, sa, size) {
		var err, _tuple, _array, _struct, _view, r1, e1;
		err = null;
		_array = new Uint8Array(12);
		_tuple = Syscall6(procCreatePipe.Addr(), 4, readhandle, writehandle, _array, (size >>> 0), 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		_struct = sa, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Length = _view.getUint32(0, true), _struct.SecurityDescriptor = _view.getUintptr(4, true), _struct.InheritHandle = _view.getUint32(8, true);
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var GetFileType = go$pkg.GetFileType = function(filehandle) {
		var n, err, _tuple, r0, e1;
		n = 0;
		err = null;
		_tuple = Syscall(procGetFileType.Addr(), 1, (filehandle >>> 0), 0, 0), r0 = _tuple[0], e1 = _tuple[2];
		n = (r0 >>> 0);
		if (n === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [n, err];
	};
	var CryptAcquireContext = go$pkg.CryptAcquireContext = function(provhandle, container, provider, provtype, flags) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall6(procCryptAcquireContextW.Addr(), 5, provhandle, container, provider, (provtype >>> 0), (flags >>> 0), 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var CryptReleaseContext = go$pkg.CryptReleaseContext = function(provhandle, flags) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procCryptReleaseContext.Addr(), 2, (provhandle >>> 0), (flags >>> 0), 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var CryptGenRandom = go$pkg.CryptGenRandom = function(provhandle, buflen, buf) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procCryptGenRandom.Addr(), 3, (provhandle >>> 0), (buflen >>> 0), buf), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var GetEnvironmentStrings = go$pkg.GetEnvironmentStrings = function() {
		var envs, err, _tuple, r0, e1;
		envs = (go$ptrType(Go$Uint16)).nil;
		err = null;
		_tuple = Syscall(procGetEnvironmentStringsW.Addr(), 0, 0, 0, 0), r0 = _tuple[0], e1 = _tuple[2];
		envs = r0;
		if (go$pointerIsEqual(envs, (go$ptrType(Go$Uint16)).nil)) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [envs, err];
	};
	var FreeEnvironmentStrings = go$pkg.FreeEnvironmentStrings = function(envs) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procFreeEnvironmentStringsW.Addr(), 1, envs, 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var GetEnvironmentVariable = go$pkg.GetEnvironmentVariable = function(name, buffer, size) {
		var n, err, _tuple, r0, e1;
		n = 0;
		err = null;
		_tuple = Syscall(procGetEnvironmentVariableW.Addr(), 3, name, buffer, (size >>> 0)), r0 = _tuple[0], e1 = _tuple[2];
		n = (r0 >>> 0);
		if (n === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [n, err];
	};
	var SetEnvironmentVariable = go$pkg.SetEnvironmentVariable = function(name, value) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procSetEnvironmentVariableW.Addr(), 2, name, value, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var SetFileTime = go$pkg.SetFileTime = function(handle, ctime, atime, wtime) {
		var err, _tuple, _array, _struct, _view, _array$1, _struct$1, _view$1, _array$2, _struct$2, _view$2, r1, e1;
		err = null;
		_array = new Uint8Array(8);
		_array$1 = new Uint8Array(8);
		_struct = ctime, _view = new DataView(_array.buffer, _array.byteOffset), _struct.LowDateTime = _view.getUint32(0, true), _struct.HighDateTime = _view.getUint32(4, true);
		_array$2 = new Uint8Array(8);
		_struct$1 = atime, _view$1 = new DataView(_array$1.buffer, _array$1.byteOffset), _struct$1.LowDateTime = _view$1.getUint32(0, true), _struct$1.HighDateTime = _view$1.getUint32(4, true);
		_tuple = Syscall6(procSetFileTime.Addr(), 4, (handle >>> 0), _array, _array$1, _array$2, 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		_struct$2 = wtime, _view$2 = new DataView(_array$2.buffer, _array$2.byteOffset), _struct$2.LowDateTime = _view$2.getUint32(0, true), _struct$2.HighDateTime = _view$2.getUint32(4, true);
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var GetFileAttributes = go$pkg.GetFileAttributes = function(name) {
		var attrs, err, _tuple, r0, e1;
		attrs = 0;
		err = null;
		_tuple = Syscall(procGetFileAttributesW.Addr(), 1, name, 0, 0), r0 = _tuple[0], e1 = _tuple[2];
		attrs = (r0 >>> 0);
		if (attrs === 4294967295) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [attrs, err];
	};
	var SetFileAttributes = go$pkg.SetFileAttributes = function(name, attrs) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procSetFileAttributesW.Addr(), 2, name, (attrs >>> 0), 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var GetFileAttributesEx = go$pkg.GetFileAttributesEx = function(name, level, info) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procGetFileAttributesExW.Addr(), 3, name, (level >>> 0), info), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var GetCommandLine = go$pkg.GetCommandLine = function() {
		var cmd, _tuple, r0;
		cmd = (go$ptrType(Go$Uint16)).nil;
		_tuple = Syscall(procGetCommandLineW.Addr(), 0, 0, 0, 0), r0 = _tuple[0];
		cmd = r0;
		return cmd;
	};
	var CommandLineToArgv = go$pkg.CommandLineToArgv = function(cmd, argc) {
		var argv, err, _tuple, r0, e1;
		argv = (go$ptrType((go$arrayType((go$ptrType((go$arrayType(Go$Uint16, 8192)))), 8192)))).nil;
		err = null;
		_tuple = Syscall(procCommandLineToArgvW.Addr(), 2, cmd, argc, 0), r0 = _tuple[0], e1 = _tuple[2];
		argv = r0;
		if (go$arrayIsEqual(argv, (go$ptrType((go$arrayType((go$ptrType((go$arrayType(Go$Uint16, 8192)))), 8192)))).nil)) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [argv, err];
	};
	var LocalFree = go$pkg.LocalFree = function(hmem) {
		var handle, err, _tuple, r0, e1;
		handle = 0;
		err = null;
		_tuple = Syscall(procLocalFree.Addr(), 1, (hmem >>> 0), 0, 0), r0 = _tuple[0], e1 = _tuple[2];
		handle = (r0 >>> 0);
		if (!((handle === 0))) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [handle, err];
	};
	var SetHandleInformation = go$pkg.SetHandleInformation = function(handle, mask, flags) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procSetHandleInformation.Addr(), 3, (handle >>> 0), (mask >>> 0), (flags >>> 0)), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var FlushFileBuffers = go$pkg.FlushFileBuffers = function(handle) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procFlushFileBuffers.Addr(), 1, (handle >>> 0), 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var GetFullPathName = go$pkg.GetFullPathName = function(path, buflen, buf, fname) {
		var n, err, _tuple, r0, e1;
		n = 0;
		err = null;
		_tuple = Syscall6(procGetFullPathNameW.Addr(), 4, path, (buflen >>> 0), buf, fname, 0, 0), r0 = _tuple[0], e1 = _tuple[2];
		n = (r0 >>> 0);
		if (n === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [n, err];
	};
	var GetLongPathName = go$pkg.GetLongPathName = function(path, buf, buflen) {
		var n, err, _tuple, r0, e1;
		n = 0;
		err = null;
		_tuple = Syscall(procGetLongPathNameW.Addr(), 3, path, buf, (buflen >>> 0)), r0 = _tuple[0], e1 = _tuple[2];
		n = (r0 >>> 0);
		if (n === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [n, err];
	};
	var GetShortPathName = go$pkg.GetShortPathName = function(longpath, shortpath, buflen) {
		var n, err, _tuple, r0, e1;
		n = 0;
		err = null;
		_tuple = Syscall(procGetShortPathNameW.Addr(), 3, longpath, shortpath, (buflen >>> 0)), r0 = _tuple[0], e1 = _tuple[2];
		n = (r0 >>> 0);
		if (n === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [n, err];
	};
	var CreateFileMapping = go$pkg.CreateFileMapping = function(fhandle, sa, prot, maxSizeHigh, maxSizeLow, name) {
		var handle, err, _tuple, _array, _struct, _view, r0, e1;
		handle = 0;
		err = null;
		_array = new Uint8Array(12);
		_tuple = Syscall6(procCreateFileMappingW.Addr(), 6, (fhandle >>> 0), _array, (prot >>> 0), (maxSizeHigh >>> 0), (maxSizeLow >>> 0), name), r0 = _tuple[0], e1 = _tuple[2];
		_struct = sa, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Length = _view.getUint32(0, true), _struct.SecurityDescriptor = _view.getUintptr(4, true), _struct.InheritHandle = _view.getUint32(8, true);
		handle = (r0 >>> 0);
		if (handle === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [handle, err];
	};
	var MapViewOfFile = go$pkg.MapViewOfFile = function(handle, access, offsetHigh, offsetLow, length) {
		var addr, err, _tuple, r0, e1;
		addr = 0;
		err = null;
		_tuple = Syscall6(procMapViewOfFile.Addr(), 5, (handle >>> 0), (access >>> 0), (offsetHigh >>> 0), (offsetLow >>> 0), length, 0), r0 = _tuple[0], e1 = _tuple[2];
		addr = r0;
		if (addr === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [addr, err];
	};
	var UnmapViewOfFile = go$pkg.UnmapViewOfFile = function(addr) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procUnmapViewOfFile.Addr(), 1, addr, 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var FlushViewOfFile = go$pkg.FlushViewOfFile = function(addr, length) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procFlushViewOfFile.Addr(), 2, addr, length, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var VirtualLock = go$pkg.VirtualLock = function(addr, length) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procVirtualLock.Addr(), 2, addr, length, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var VirtualUnlock = go$pkg.VirtualUnlock = function(addr, length) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procVirtualUnlock.Addr(), 2, addr, length, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var TransmitFile = go$pkg.TransmitFile = function(s, handle, bytesToWrite, bytsPerSend, overlapped, transmitFileBuf, flags) {
		var err, _tuple, _array, _struct, _view, _array$1, _struct$1, _view$1, r1, e1;
		err = null;
		_array = new Uint8Array(20);
		_array$1 = new Uint8Array(16);
		_struct = overlapped, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Internal = _view.getUintptr(0, true), _struct.InternalHigh = _view.getUintptr(4, true), _struct.Offset = _view.getUint32(8, true), _struct.OffsetHigh = _view.getUint32(12, true), _struct.HEvent = _view.getUintptr(16, true);
		_tuple = Syscall9(procTransmitFile.Addr(), 7, (s >>> 0), (handle >>> 0), (bytesToWrite >>> 0), (bytsPerSend >>> 0), _array, _array$1, (flags >>> 0), 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		_struct$1 = transmitFileBuf, _view$1 = new DataView(_array$1.buffer, _array$1.byteOffset), _struct$1.Head = _view$1.getUintptr(0, true), _struct$1.HeadLength = _view$1.getUint32(4, true), _struct$1.Tail = _view$1.getUintptr(8, true), _struct$1.TailLength = _view$1.getUint32(12, true);
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var ReadDirectoryChanges = go$pkg.ReadDirectoryChanges = function(handle, buf, buflen, watchSubTree, mask, retlen, overlapped, completionRoutine) {
		var err, _p0, _tuple, _array, _struct, _view, r1, e1;
		err = null;
		_p0 = 0;
		if (watchSubTree) {
			_p0 = 1;
		} else {
			_p0 = 0;
		}
		_array = new Uint8Array(20);
		_tuple = Syscall9(procReadDirectoryChangesW.Addr(), 8, (handle >>> 0), buf, (buflen >>> 0), (_p0 >>> 0), (mask >>> 0), retlen, _array, completionRoutine, 0), r1 = _tuple[0], e1 = _tuple[2];
		_struct = overlapped, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Internal = _view.getUintptr(0, true), _struct.InternalHigh = _view.getUintptr(4, true), _struct.Offset = _view.getUint32(8, true), _struct.OffsetHigh = _view.getUint32(12, true), _struct.HEvent = _view.getUintptr(16, true);
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var CertOpenSystemStore = go$pkg.CertOpenSystemStore = function(hprov, name) {
		var store, err, _tuple, r0, e1;
		store = 0;
		err = null;
		_tuple = Syscall(procCertOpenSystemStoreW.Addr(), 2, (hprov >>> 0), name, 0), r0 = _tuple[0], e1 = _tuple[2];
		store = (r0 >>> 0);
		if (store === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [store, err];
	};
	var CertOpenStore = go$pkg.CertOpenStore = function(storeProvider, msgAndCertEncodingType, cryptProv, flags, para) {
		var handle, err, _tuple, r0, e1;
		handle = 0;
		err = null;
		_tuple = Syscall6(procCertOpenStore.Addr(), 5, storeProvider, (msgAndCertEncodingType >>> 0), cryptProv, (flags >>> 0), para, 0), r0 = _tuple[0], e1 = _tuple[2];
		handle = (r0 >>> 0);
		if (handle === 4294967295) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [handle, err];
	};
	var CertEnumCertificatesInStore = go$pkg.CertEnumCertificatesInStore = function(store, prevContext) {
		var context, err, _tuple, _array, _struct, _view, r0, e1, _array$1, _struct$1, _view$1;
		context = (go$ptrType(CertContext)).nil;
		err = null;
		_array = new Uint8Array(20);
		_tuple = Syscall(procCertEnumCertificatesInStore.Addr(), 2, (store >>> 0), _array, 0), r0 = _tuple[0], e1 = _tuple[2];
		_struct = prevContext, _view = new DataView(_array.buffer, _array.byteOffset), _struct.EncodingType = _view.getUint32(0, true), _struct.Length = _view.getUint32(8, true), _struct.CertInfo = _view.getUintptr(12, true), _struct.Store = _view.getUintptr(16, true);
		context = (_array$1 = r0, _struct$1 = new CertContext.Ptr(), _view$1 = new DataView(_array$1.buffer, _array$1.byteOffset), _struct$1.EncodingType = _view$1.getUint32(0, true), _struct$1.Length = _view$1.getUint32(8, true), _struct$1.CertInfo = _view$1.getUintptr(12, true), _struct$1.Store = _view$1.getUintptr(16, true), _struct$1);
		if (context === (go$ptrType(CertContext)).nil) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [context, err];
	};
	var CertAddCertificateContextToStore = go$pkg.CertAddCertificateContextToStore = function(store, certContext, addDisposition, storeContext) {
		var err, _tuple, _array, _struct, _view, r1, e1;
		err = null;
		_array = new Uint8Array(20);
		_tuple = Syscall6(procCertAddCertificateContextToStore.Addr(), 4, (store >>> 0), _array, (addDisposition >>> 0), storeContext, 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		_struct = certContext, _view = new DataView(_array.buffer, _array.byteOffset), _struct.EncodingType = _view.getUint32(0, true), _struct.Length = _view.getUint32(8, true), _struct.CertInfo = _view.getUintptr(12, true), _struct.Store = _view.getUintptr(16, true);
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var CertCloseStore = go$pkg.CertCloseStore = function(store, flags) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procCertCloseStore.Addr(), 2, (store >>> 0), (flags >>> 0), 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var CertGetCertificateChain = go$pkg.CertGetCertificateChain = function(engine, leaf, time, additionalStore, para, flags, reserved, chainCtx) {
		var err, _tuple, _array, _struct, _view, _array$1, _struct$1, _view$1, _array$2, _struct$2, _view$2, r1, e1;
		err = null;
		_array = new Uint8Array(20);
		_array$1 = new Uint8Array(8);
		_struct = leaf, _view = new DataView(_array.buffer, _array.byteOffset), _struct.EncodingType = _view.getUint32(0, true), _struct.Length = _view.getUint32(8, true), _struct.CertInfo = _view.getUintptr(12, true), _struct.Store = _view.getUintptr(16, true);
		_array$2 = new Uint8Array(44);
		_struct$1 = time, _view$1 = new DataView(_array$1.buffer, _array$1.byteOffset), _struct$1.LowDateTime = _view$1.getUint32(0, true), _struct$1.HighDateTime = _view$1.getUint32(4, true);
		_tuple = Syscall9(procCertGetCertificateChain.Addr(), 8, (engine >>> 0), _array, _array$1, (additionalStore >>> 0), _array$2, (flags >>> 0), reserved, chainCtx, 0), r1 = _tuple[0], e1 = _tuple[2];
		_struct$2 = para, _view$2 = new DataView(_array$2.buffer, _array$2.byteOffset), _struct$2.Size = _view$2.getUint32(0, true), _struct$2.RequestedUsage.Type = _view$2.getUint32(4, true), _struct$2.RequestedUsage.Usage.Length = _view$2.getUint32(8, true), _struct$2.RequstedIssuancePolicy.Type = _view$2.getUint32(16, true), _struct$2.RequstedIssuancePolicy.Usage.Length = _view$2.getUint32(20, true), _struct$2.URLRetrievalTimeout = _view$2.getUint32(28, true), _struct$2.CheckRevocationFreshnessTime = _view$2.getUint32(32, true), _struct$2.RevocationFreshnessTime = _view$2.getUint32(36, true);
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var CertFreeCertificateChain = go$pkg.CertFreeCertificateChain = function(ctx) {
		var _array, _struct, _view;
		_array = new Uint8Array(36);
		Syscall(procCertFreeCertificateChain.Addr(), 1, _array, 0, 0);
		_struct = ctx, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Size = _view.getUint32(0, true), _struct.TrustStatus.ErrorStatus = _view.getUint32(4, true), _struct.TrustStatus.InfoStatus = _view.getUint32(8, true), _struct.ChainCount = _view.getUint32(12, true), _struct.LowerQualityChainCount = _view.getUint32(20, true), _struct.HasRevocationFreshnessTime = _view.getUint32(28, true), _struct.RevocationFreshnessTime = _view.getUint32(32, true);
		return;
	};
	var CertCreateCertificateContext = go$pkg.CertCreateCertificateContext = function(certEncodingType, certEncoded, encodedLen) {
		var context, err, _tuple, r0, e1, _array, _struct, _view;
		context = (go$ptrType(CertContext)).nil;
		err = null;
		_tuple = Syscall(procCertCreateCertificateContext.Addr(), 3, (certEncodingType >>> 0), certEncoded, (encodedLen >>> 0)), r0 = _tuple[0], e1 = _tuple[2];
		context = (_array = r0, _struct = new CertContext.Ptr(), _view = new DataView(_array.buffer, _array.byteOffset), _struct.EncodingType = _view.getUint32(0, true), _struct.Length = _view.getUint32(8, true), _struct.CertInfo = _view.getUintptr(12, true), _struct.Store = _view.getUintptr(16, true), _struct);
		if (context === (go$ptrType(CertContext)).nil) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [context, err];
	};
	var CertFreeCertificateContext = go$pkg.CertFreeCertificateContext = function(ctx) {
		var err, _tuple, _array, _struct, _view, r1, e1;
		err = null;
		_array = new Uint8Array(20);
		_tuple = Syscall(procCertFreeCertificateContext.Addr(), 1, _array, 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		_struct = ctx, _view = new DataView(_array.buffer, _array.byteOffset), _struct.EncodingType = _view.getUint32(0, true), _struct.Length = _view.getUint32(8, true), _struct.CertInfo = _view.getUintptr(12, true), _struct.Store = _view.getUintptr(16, true);
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var CertVerifyCertificateChainPolicy = go$pkg.CertVerifyCertificateChainPolicy = function(policyOID, chain, para, status) {
		var err, _tuple, _array, _struct, _view, _array$1, _struct$1, _view$1, _array$2, _struct$2, _view$2, r1, e1;
		err = null;
		_array = new Uint8Array(36);
		_array$1 = new Uint8Array(12);
		_struct = chain, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Size = _view.getUint32(0, true), _struct.TrustStatus.ErrorStatus = _view.getUint32(4, true), _struct.TrustStatus.InfoStatus = _view.getUint32(8, true), _struct.ChainCount = _view.getUint32(12, true), _struct.LowerQualityChainCount = _view.getUint32(20, true), _struct.HasRevocationFreshnessTime = _view.getUint32(28, true), _struct.RevocationFreshnessTime = _view.getUint32(32, true);
		_array$2 = new Uint8Array(20);
		_struct$1 = para, _view$1 = new DataView(_array$1.buffer, _array$1.byteOffset), _struct$1.Size = _view$1.getUint32(0, true), _struct$1.Flags = _view$1.getUint32(4, true), _struct$1.ExtraPolicyPara = _view$1.getUintptr(8, true);
		_tuple = Syscall6(procCertVerifyCertificateChainPolicy.Addr(), 4, policyOID, _array, _array$1, _array$2, 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		_struct$2 = status, _view$2 = new DataView(_array$2.buffer, _array$2.byteOffset), _struct$2.Size = _view$2.getUint32(0, true), _struct$2.Error = _view$2.getUint32(4, true), _struct$2.ChainIndex = _view$2.getUint32(8, true), _struct$2.ElementIndex = _view$2.getUint32(12, true), _struct$2.ExtraPolicyStatus = _view$2.getUintptr(16, true);
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var RegOpenKeyEx = go$pkg.RegOpenKeyEx = function(key, subkey, options, desiredAccess, result) {
		var regerrno, _tuple, r0;
		regerrno = null;
		_tuple = Syscall6(procRegOpenKeyExW.Addr(), 5, (key >>> 0), subkey, (options >>> 0), (desiredAccess >>> 0), result, 0), r0 = _tuple[0];
		if (!((r0 === 0))) {
			regerrno = new Errno((r0 >>> 0));
		}
		return regerrno;
	};
	var RegCloseKey = go$pkg.RegCloseKey = function(key) {
		var regerrno, _tuple, r0;
		regerrno = null;
		_tuple = Syscall(procRegCloseKey.Addr(), 1, (key >>> 0), 0, 0), r0 = _tuple[0];
		if (!((r0 === 0))) {
			regerrno = new Errno((r0 >>> 0));
		}
		return regerrno;
	};
	var RegQueryInfoKey = go$pkg.RegQueryInfoKey = function(key, class$1, classLen, reserved, subkeysLen, maxSubkeyLen, maxClassLen, valuesLen, maxValueNameLen, maxValueLen, saLen, lastWriteTime) {
		var regerrno, _tuple, _array, _struct, _view, r0;
		regerrno = null;
		_array = new Uint8Array(8);
		_tuple = Syscall12(procRegQueryInfoKeyW.Addr(), 12, (key >>> 0), class$1, classLen, reserved, subkeysLen, maxSubkeyLen, maxClassLen, valuesLen, maxValueNameLen, maxValueLen, saLen, _array), r0 = _tuple[0];
		_struct = lastWriteTime, _view = new DataView(_array.buffer, _array.byteOffset), _struct.LowDateTime = _view.getUint32(0, true), _struct.HighDateTime = _view.getUint32(4, true);
		if (!((r0 === 0))) {
			regerrno = new Errno((r0 >>> 0));
		}
		return regerrno;
	};
	var RegEnumKeyEx = go$pkg.RegEnumKeyEx = function(key, index, name, nameLen, reserved, class$1, classLen, lastWriteTime) {
		var regerrno, _tuple, _array, _struct, _view, r0;
		regerrno = null;
		_array = new Uint8Array(8);
		_tuple = Syscall9(procRegEnumKeyExW.Addr(), 8, (key >>> 0), (index >>> 0), name, nameLen, reserved, class$1, classLen, _array, 0), r0 = _tuple[0];
		_struct = lastWriteTime, _view = new DataView(_array.buffer, _array.byteOffset), _struct.LowDateTime = _view.getUint32(0, true), _struct.HighDateTime = _view.getUint32(4, true);
		if (!((r0 === 0))) {
			regerrno = new Errno((r0 >>> 0));
		}
		return regerrno;
	};
	var RegQueryValueEx = go$pkg.RegQueryValueEx = function(key, name, reserved, valtype, buf, buflen) {
		var regerrno, _tuple, r0;
		regerrno = null;
		_tuple = Syscall6(procRegQueryValueExW.Addr(), 6, (key >>> 0), name, reserved, valtype, buf, buflen), r0 = _tuple[0];
		if (!((r0 === 0))) {
			regerrno = new Errno((r0 >>> 0));
		}
		return regerrno;
	};
	var getCurrentProcessId = function() {
		var pid, _tuple, r0;
		pid = 0;
		_tuple = Syscall(procGetCurrentProcessId.Addr(), 0, 0, 0, 0), r0 = _tuple[0];
		pid = (r0 >>> 0);
		return pid;
	};
	var GetConsoleMode = go$pkg.GetConsoleMode = function(console, mode) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procGetConsoleMode.Addr(), 2, (console >>> 0), mode, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var WriteConsole = go$pkg.WriteConsole = function(console, buf, towrite, written, reserved) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall6(procWriteConsoleW.Addr(), 5, (console >>> 0), buf, (towrite >>> 0), written, reserved, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var ReadConsole = go$pkg.ReadConsole = function(console, buf, toread, read, inputControl) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall6(procReadConsoleW.Addr(), 5, (console >>> 0), buf, (toread >>> 0), read, inputControl, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var WSAStartup = go$pkg.WSAStartup = function(verreq, data) {
		var sockerr, _tuple, _array, _struct, _view, r0;
		sockerr = null;
		_array = new Uint8Array(398);
		_tuple = Syscall(procWSAStartup.Addr(), 2, (verreq >>> 0), _array, 0), r0 = _tuple[0];
		_struct = data, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Version = _view.getUint16(0, true), _struct.HighVersion = _view.getUint16(2, true), _struct.MaxSockets = _view.getUint16(4, true), _struct.MaxUdpDg = _view.getUint16(6, true), _struct.Description = new (go$nativeArray("Uint8"))(_array.buffer, go$min(_array.byteOffset + 12, _array.buffer.byteLength)), _struct.SystemStatus = new (go$nativeArray("Uint8"))(_array.buffer, go$min(_array.byteOffset + 269, _array.buffer.byteLength));
		if (!((r0 === 0))) {
			sockerr = new Errno((r0 >>> 0));
		}
		return sockerr;
	};
	var WSACleanup = go$pkg.WSACleanup = function() {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procWSACleanup.Addr(), 0, 0, 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 4294967295) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var WSAIoctl = go$pkg.WSAIoctl = function(s, iocc, inbuf, cbif, outbuf, cbob, cbbr, overlapped, completionRoutine) {
		var err, _tuple, _array, _struct, _view, r1, e1;
		err = null;
		_array = new Uint8Array(20);
		_tuple = Syscall9(procWSAIoctl.Addr(), 9, (s >>> 0), (iocc >>> 0), inbuf, (cbif >>> 0), outbuf, (cbob >>> 0), cbbr, _array, completionRoutine), r1 = _tuple[0], e1 = _tuple[2];
		_struct = overlapped, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Internal = _view.getUintptr(0, true), _struct.InternalHigh = _view.getUintptr(4, true), _struct.Offset = _view.getUint32(8, true), _struct.OffsetHigh = _view.getUint32(12, true), _struct.HEvent = _view.getUintptr(16, true);
		if (r1 === 4294967295) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var socket = function(af, typ, protocol) {
		var handle, err, _tuple, r0, e1;
		handle = 0;
		err = null;
		_tuple = Syscall(procsocket.Addr(), 3, (af >>> 0), (typ >>> 0), (protocol >>> 0)), r0 = _tuple[0], e1 = _tuple[2];
		handle = (r0 >>> 0);
		if (handle === 4294967295) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [handle, err];
	};
	var Setsockopt = go$pkg.Setsockopt = function(s, level, optname, optval, optlen) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall6(procsetsockopt.Addr(), 5, (s >>> 0), (level >>> 0), (optname >>> 0), optval, (optlen >>> 0), 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 4294967295) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var Getsockopt = go$pkg.Getsockopt = function(s, level, optname, optval, optlen) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall6(procgetsockopt.Addr(), 5, (s >>> 0), (level >>> 0), (optname >>> 0), optval, optlen, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 4294967295) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var bind = function(s, name, namelen) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procbind.Addr(), 3, (s >>> 0), name, (namelen >>> 0)), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 4294967295) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var connect = function(s, name, namelen) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procconnect.Addr(), 3, (s >>> 0), name, (namelen >>> 0)), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 4294967295) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var getsockname = function(s, rsa, addrlen) {
		var err, _tuple, _array, _struct, _view, r1, e1;
		err = null;
		_array = new Uint8Array(112);
		_tuple = Syscall(procgetsockname.Addr(), 3, (s >>> 0), _array, addrlen), r1 = _tuple[0], e1 = _tuple[2];
		_struct = rsa, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Addr.Family = _view.getUint16(0, true), _struct.Addr.Data = new (go$nativeArray("Int8"))(_array.buffer, go$min(_array.byteOffset + 2, _array.buffer.byteLength)), _struct.Pad = new (go$nativeArray("Int8"))(_array.buffer, go$min(_array.byteOffset + 16, _array.buffer.byteLength));
		if (r1 === 4294967295) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var getpeername = function(s, rsa, addrlen) {
		var err, _tuple, _array, _struct, _view, r1, e1;
		err = null;
		_array = new Uint8Array(112);
		_tuple = Syscall(procgetpeername.Addr(), 3, (s >>> 0), _array, addrlen), r1 = _tuple[0], e1 = _tuple[2];
		_struct = rsa, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Addr.Family = _view.getUint16(0, true), _struct.Addr.Data = new (go$nativeArray("Int8"))(_array.buffer, go$min(_array.byteOffset + 2, _array.buffer.byteLength)), _struct.Pad = new (go$nativeArray("Int8"))(_array.buffer, go$min(_array.byteOffset + 16, _array.buffer.byteLength));
		if (r1 === 4294967295) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var listen = function(s, backlog) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(proclisten.Addr(), 2, (s >>> 0), (backlog >>> 0), 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 4294967295) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var shutdown = function(s, how) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procshutdown.Addr(), 2, (s >>> 0), (how >>> 0), 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 4294967295) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var Closesocket = go$pkg.Closesocket = function(s) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procclosesocket.Addr(), 1, (s >>> 0), 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 4294967295) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var AcceptEx = go$pkg.AcceptEx = function(ls, as, buf, rxdatalen, laddrlen, raddrlen, recvd, overlapped) {
		var err, _tuple, _array, _struct, _view, r1, e1;
		err = null;
		_array = new Uint8Array(20);
		_tuple = Syscall9(procAcceptEx.Addr(), 8, (ls >>> 0), (as >>> 0), buf, (rxdatalen >>> 0), (laddrlen >>> 0), (raddrlen >>> 0), recvd, _array, 0), r1 = _tuple[0], e1 = _tuple[2];
		_struct = overlapped, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Internal = _view.getUintptr(0, true), _struct.InternalHigh = _view.getUintptr(4, true), _struct.Offset = _view.getUint32(8, true), _struct.OffsetHigh = _view.getUint32(12, true), _struct.HEvent = _view.getUintptr(16, true);
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var GetAcceptExSockaddrs = go$pkg.GetAcceptExSockaddrs = function(buf, rxdatalen, laddrlen, raddrlen, lrsa, lrsalen, rrsa, rrsalen) {
		Syscall9(procGetAcceptExSockaddrs.Addr(), 8, buf, (rxdatalen >>> 0), (laddrlen >>> 0), (raddrlen >>> 0), lrsa, lrsalen, rrsa, rrsalen, 0);
		return;
	};
	var WSARecv = go$pkg.WSARecv = function(s, bufs, bufcnt, recvd, flags, overlapped, croutine) {
		var err, _tuple, _array, _struct, _view, _array$1, _struct$1, _view$1, r1, e1;
		err = null;
		_array = new Uint8Array(8);
		_array$1 = new Uint8Array(20);
		_struct = bufs, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Len = _view.getUint32(0, true);
		_tuple = Syscall9(procWSARecv.Addr(), 7, (s >>> 0), _array, (bufcnt >>> 0), recvd, flags, _array$1, croutine, 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		_struct$1 = overlapped, _view$1 = new DataView(_array$1.buffer, _array$1.byteOffset), _struct$1.Internal = _view$1.getUintptr(0, true), _struct$1.InternalHigh = _view$1.getUintptr(4, true), _struct$1.Offset = _view$1.getUint32(8, true), _struct$1.OffsetHigh = _view$1.getUint32(12, true), _struct$1.HEvent = _view$1.getUintptr(16, true);
		if (r1 === 4294967295) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var WSASend = go$pkg.WSASend = function(s, bufs, bufcnt, sent, flags, overlapped, croutine) {
		var err, _tuple, _array, _struct, _view, _array$1, _struct$1, _view$1, r1, e1;
		err = null;
		_array = new Uint8Array(8);
		_array$1 = new Uint8Array(20);
		_struct = bufs, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Len = _view.getUint32(0, true);
		_tuple = Syscall9(procWSASend.Addr(), 7, (s >>> 0), _array, (bufcnt >>> 0), sent, (flags >>> 0), _array$1, croutine, 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		_struct$1 = overlapped, _view$1 = new DataView(_array$1.buffer, _array$1.byteOffset), _struct$1.Internal = _view$1.getUintptr(0, true), _struct$1.InternalHigh = _view$1.getUintptr(4, true), _struct$1.Offset = _view$1.getUint32(8, true), _struct$1.OffsetHigh = _view$1.getUint32(12, true), _struct$1.HEvent = _view$1.getUintptr(16, true);
		if (r1 === 4294967295) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var WSARecvFrom = go$pkg.WSARecvFrom = function(s, bufs, bufcnt, recvd, flags, from, fromlen, overlapped, croutine) {
		var err, _tuple, _array, _struct, _view, _array$1, _struct$1, _view$1, _array$2, _struct$2, _view$2, r1, e1;
		err = null;
		_array = new Uint8Array(8);
		_array$1 = new Uint8Array(112);
		_struct = bufs, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Len = _view.getUint32(0, true);
		_array$2 = new Uint8Array(20);
		_struct$1 = from, _view$1 = new DataView(_array$1.buffer, _array$1.byteOffset), _struct$1.Addr.Family = _view$1.getUint16(0, true), _struct$1.Addr.Data = new (go$nativeArray("Int8"))(_array$1.buffer, go$min(_array$1.byteOffset + 2, _array$1.buffer.byteLength)), _struct$1.Pad = new (go$nativeArray("Int8"))(_array$1.buffer, go$min(_array$1.byteOffset + 16, _array$1.buffer.byteLength));
		_tuple = Syscall9(procWSARecvFrom.Addr(), 9, (s >>> 0), _array, (bufcnt >>> 0), recvd, flags, _array$1, fromlen, _array$2, croutine), r1 = _tuple[0], e1 = _tuple[2];
		_struct$2 = overlapped, _view$2 = new DataView(_array$2.buffer, _array$2.byteOffset), _struct$2.Internal = _view$2.getUintptr(0, true), _struct$2.InternalHigh = _view$2.getUintptr(4, true), _struct$2.Offset = _view$2.getUint32(8, true), _struct$2.OffsetHigh = _view$2.getUint32(12, true), _struct$2.HEvent = _view$2.getUintptr(16, true);
		if (r1 === 4294967295) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var WSASendTo = go$pkg.WSASendTo = function(s, bufs, bufcnt, sent, flags, to, tolen, overlapped, croutine) {
		var err, _tuple, _array, _struct, _view, _array$1, _struct$1, _view$1, _array$2, _struct$2, _view$2, r1, e1;
		err = null;
		_array = new Uint8Array(8);
		_array$1 = new Uint8Array(112);
		_struct = bufs, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Len = _view.getUint32(0, true);
		_array$2 = new Uint8Array(20);
		_struct$1 = to, _view$1 = new DataView(_array$1.buffer, _array$1.byteOffset), _struct$1.Addr.Family = _view$1.getUint16(0, true), _struct$1.Addr.Data = new (go$nativeArray("Int8"))(_array$1.buffer, go$min(_array$1.byteOffset + 2, _array$1.buffer.byteLength)), _struct$1.Pad = new (go$nativeArray("Int8"))(_array$1.buffer, go$min(_array$1.byteOffset + 16, _array$1.buffer.byteLength));
		_tuple = Syscall9(procWSASendTo.Addr(), 9, (s >>> 0), _array, (bufcnt >>> 0), sent, (flags >>> 0), _array$1, (tolen >>> 0), _array$2, croutine), r1 = _tuple[0], e1 = _tuple[2];
		_struct$2 = overlapped, _view$2 = new DataView(_array$2.buffer, _array$2.byteOffset), _struct$2.Internal = _view$2.getUintptr(0, true), _struct$2.InternalHigh = _view$2.getUintptr(4, true), _struct$2.Offset = _view$2.getUint32(8, true), _struct$2.OffsetHigh = _view$2.getUint32(12, true), _struct$2.HEvent = _view$2.getUintptr(16, true);
		if (r1 === 4294967295) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var GetHostByName = go$pkg.GetHostByName = function(name) {
		var h, err, _p0, _tuple, _tuple$1, r0, e1, _array, _struct, _view;
		h = (go$ptrType(Hostent)).nil;
		err = null;
		_p0 = (go$ptrType(Go$Uint8)).nil;
		_tuple = BytePtrFromString(name), _p0 = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			return [h, err];
		}
		_tuple$1 = Syscall(procgethostbyname.Addr(), 1, _p0, 0, 0), r0 = _tuple$1[0], e1 = _tuple$1[2];
		h = (_array = r0, _struct = new Hostent.Ptr(), _view = new DataView(_array.buffer, _array.byteOffset), _struct.AddrType = _view.getUint16(8, true), _struct.Length = _view.getUint16(10, true), _struct);
		if (h === (go$ptrType(Hostent)).nil) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [h, err];
	};
	var GetServByName = go$pkg.GetServByName = function(name, proto) {
		var s, err, _p0, _tuple, _p1, _tuple$1, _tuple$2, r0, e1, _array, _struct, _view;
		s = (go$ptrType(Servent)).nil;
		err = null;
		_p0 = (go$ptrType(Go$Uint8)).nil;
		_tuple = BytePtrFromString(name), _p0 = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			return [s, err];
		}
		_p1 = (go$ptrType(Go$Uint8)).nil;
		_tuple$1 = BytePtrFromString(proto), _p1 = _tuple$1[0], err = _tuple$1[1];
		if (!(go$interfaceIsEqual(err, null))) {
			return [s, err];
		}
		_tuple$2 = Syscall(procgetservbyname.Addr(), 2, _p0, _p1, 0), r0 = _tuple$2[0], e1 = _tuple$2[2];
		s = (_array = r0, _struct = new Servent.Ptr(), _view = new DataView(_array.buffer, _array.byteOffset), _struct.Port = _view.getUint16(12, true), _struct);
		if (s === (go$ptrType(Servent)).nil) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [s, err];
	};
	var Ntohs = go$pkg.Ntohs = function(netshort) {
		var u, _tuple, r0;
		u = 0;
		_tuple = Syscall(procntohs.Addr(), 1, (netshort >>> 0), 0, 0), r0 = _tuple[0];
		u = (r0 << 16 >>> 16);
		return u;
	};
	var GetProtoByName = go$pkg.GetProtoByName = function(name) {
		var p, err, _p0, _tuple, _tuple$1, r0, e1, _array, _struct, _view;
		p = (go$ptrType(Protoent)).nil;
		err = null;
		_p0 = (go$ptrType(Go$Uint8)).nil;
		_tuple = BytePtrFromString(name), _p0 = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			return [p, err];
		}
		_tuple$1 = Syscall(procgetprotobyname.Addr(), 1, _p0, 0, 0), r0 = _tuple$1[0], e1 = _tuple$1[2];
		p = (_array = r0, _struct = new Protoent.Ptr(), _view = new DataView(_array.buffer, _array.byteOffset), _struct.Proto = _view.getUint16(8, true), _struct);
		if (p === (go$ptrType(Protoent)).nil) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [p, err];
	};
	var DnsQuery = go$pkg.DnsQuery = function(name, qtype, options, extra, qrs, pr) {
		var status, _p0, _tuple, _tuple$1, r0;
		status = null;
		_p0 = (go$ptrType(Go$Uint16)).nil;
		_tuple = UTF16PtrFromString(name), _p0 = _tuple[0], status = _tuple[1];
		if (!(go$interfaceIsEqual(status, null))) {
			return status;
		}
		_tuple$1 = Syscall6(procDnsQuery_W.Addr(), 6, _p0, (qtype >>> 0), (options >>> 0), extra, qrs, pr), r0 = _tuple$1[0];
		if (!((r0 === 0))) {
			status = new Errno((r0 >>> 0));
		}
		return status;
	};
	var DnsRecordListFree = go$pkg.DnsRecordListFree = function(rl, freetype) {
		var _array, _struct, _view;
		_array = new Uint8Array(64);
		Syscall(procDnsRecordListFree.Addr(), 2, _array, (freetype >>> 0), 0);
		_struct = rl, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Type = _view.getUint16(8, true), _struct.Length = _view.getUint16(10, true), _struct.Dw = _view.getUint32(12, true), _struct.Ttl = _view.getUint32(16, true), _struct.Reserved = _view.getUint32(20, true), _struct.Data = new (go$nativeArray("Uint8"))(_array.buffer, go$min(_array.byteOffset + 24, _array.buffer.byteLength));
		return;
	};
	var GetAddrInfoW = go$pkg.GetAddrInfoW = function(nodename, servicename, hints, result) {
		var sockerr, _tuple, _array, _struct, _view, r0;
		sockerr = null;
		_array = new Uint8Array(32);
		_tuple = Syscall6(procGetAddrInfoW.Addr(), 4, nodename, servicename, _array, result, 0, 0), r0 = _tuple[0];
		_struct = hints, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Flags = _view.getInt32(0, true), _struct.Family = _view.getInt32(4, true), _struct.Socktype = _view.getInt32(8, true), _struct.Protocol = _view.getInt32(12, true), _struct.Addrlen = _view.getUintptr(16, true), _struct.Addr = _view.getUintptr(24, true);
		if (!((r0 === 0))) {
			sockerr = new Errno((r0 >>> 0));
		}
		return sockerr;
	};
	var FreeAddrInfoW = go$pkg.FreeAddrInfoW = function(addrinfo) {
		var _array, _struct, _view;
		_array = new Uint8Array(32);
		Syscall(procFreeAddrInfoW.Addr(), 1, _array, 0, 0);
		_struct = addrinfo, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Flags = _view.getInt32(0, true), _struct.Family = _view.getInt32(4, true), _struct.Socktype = _view.getInt32(8, true), _struct.Protocol = _view.getInt32(12, true), _struct.Addrlen = _view.getUintptr(16, true), _struct.Addr = _view.getUintptr(24, true);
		return;
	};
	var GetIfEntry = go$pkg.GetIfEntry = function(pIfRow) {
		var errcode, _tuple, _array, _struct, _view, r0;
		errcode = null;
		_array = new Uint8Array(860);
		_tuple = Syscall(procGetIfEntry.Addr(), 1, _array, 0, 0), r0 = _tuple[0];
		_struct = pIfRow, _view = new DataView(_array.buffer, _array.byteOffset), _struct.Name = new (go$nativeArray("Uint16"))(_array.buffer, go$min(_array.byteOffset + 0, _array.buffer.byteLength)), _struct.Index = _view.getUint32(512, true), _struct.Type = _view.getUint32(516, true), _struct.Mtu = _view.getUint32(520, true), _struct.Speed = _view.getUint32(524, true), _struct.PhysAddrLen = _view.getUint32(528, true), _struct.PhysAddr = new (go$nativeArray("Uint8"))(_array.buffer, go$min(_array.byteOffset + 532, _array.buffer.byteLength)), _struct.AdminStatus = _view.getUint32(540, true), _struct.OperStatus = _view.getUint32(544, true), _struct.LastChange = _view.getUint32(548, true), _struct.InOctets = _view.getUint32(552, true), _struct.InUcastPkts = _view.getUint32(556, true), _struct.InNUcastPkts = _view.getUint32(560, true), _struct.InDiscards = _view.getUint32(564, true), _struct.InErrors = _view.getUint32(568, true), _struct.InUnknownProtos = _view.getUint32(572, true), _struct.OutOctets = _view.getUint32(576, true), _struct.OutUcastPkts = _view.getUint32(580, true), _struct.OutNUcastPkts = _view.getUint32(584, true), _struct.OutDiscards = _view.getUint32(588, true), _struct.OutErrors = _view.getUint32(592, true), _struct.OutQLen = _view.getUint32(596, true), _struct.DescrLen = _view.getUint32(600, true), _struct.Descr = new (go$nativeArray("Uint8"))(_array.buffer, go$min(_array.byteOffset + 604, _array.buffer.byteLength));
		if (!((r0 === 0))) {
			errcode = new Errno((r0 >>> 0));
		}
		return errcode;
	};
	var GetAdaptersInfo = go$pkg.GetAdaptersInfo = function(ai, ol) {
		var errcode, _tuple, _array, _struct, _view, r0;
		errcode = null;
		_array = new Uint8Array(648);
		_tuple = Syscall(procGetAdaptersInfo.Addr(), 2, _array, ol, 0), r0 = _tuple[0];
		_struct = ai, _view = new DataView(_array.buffer, _array.byteOffset), _struct.ComboIndex = _view.getUint32(4, true), _struct.AdapterName = new (go$nativeArray("Uint8"))(_array.buffer, go$min(_array.byteOffset + 8, _array.buffer.byteLength)), _struct.Description = new (go$nativeArray("Uint8"))(_array.buffer, go$min(_array.byteOffset + 268, _array.buffer.byteLength)), _struct.AddressLength = _view.getUint32(400, true), _struct.Address = new (go$nativeArray("Uint8"))(_array.buffer, go$min(_array.byteOffset + 404, _array.buffer.byteLength)), _struct.Index = _view.getUint32(412, true), _struct.Type = _view.getUint32(416, true), _struct.DhcpEnabled = _view.getUint32(420, true), _struct.IpAddressList.IpAddress.String = new (go$nativeArray("Uint8"))(_array.buffer, go$min(_array.byteOffset + 432, _array.buffer.byteLength)), _struct.IpAddressList.IpMask.String = new (go$nativeArray("Uint8"))(_array.buffer, go$min(_array.byteOffset + 448, _array.buffer.byteLength)), _struct.IpAddressList.Context = _view.getUint32(464, true), _struct.GatewayList.IpAddress.String = new (go$nativeArray("Uint8"))(_array.buffer, go$min(_array.byteOffset + 472, _array.buffer.byteLength)), _struct.GatewayList.IpMask.String = new (go$nativeArray("Uint8"))(_array.buffer, go$min(_array.byteOffset + 488, _array.buffer.byteLength)), _struct.GatewayList.Context = _view.getUint32(504, true), _struct.DhcpServer.IpAddress.String = new (go$nativeArray("Uint8"))(_array.buffer, go$min(_array.byteOffset + 512, _array.buffer.byteLength)), _struct.DhcpServer.IpMask.String = new (go$nativeArray("Uint8"))(_array.buffer, go$min(_array.byteOffset + 528, _array.buffer.byteLength)), _struct.DhcpServer.Context = _view.getUint32(544, true), _struct.PrimaryWinsServer.IpAddress.String = new (go$nativeArray("Uint8"))(_array.buffer, go$min(_array.byteOffset + 556, _array.buffer.byteLength)), _struct.PrimaryWinsServer.IpMask.String = new (go$nativeArray("Uint8"))(_array.buffer, go$min(_array.byteOffset + 572, _array.buffer.byteLength)), _struct.PrimaryWinsServer.Context = _view.getUint32(588, true), _struct.SecondaryWinsServer.IpAddress.String = new (go$nativeArray("Uint8"))(_array.buffer, go$min(_array.byteOffset + 596, _array.buffer.byteLength)), _struct.SecondaryWinsServer.IpMask.String = new (go$nativeArray("Uint8"))(_array.buffer, go$min(_array.byteOffset + 612, _array.buffer.byteLength)), _struct.SecondaryWinsServer.Context = _view.getUint32(628, true), _struct.LeaseObtained = new Go$Int64(_view.getUint32(636, true), _view.getUint32(632, true)), _struct.LeaseExpires = new Go$Int64(_view.getUint32(644, true), _view.getUint32(640, true));
		if (!((r0 === 0))) {
			errcode = new Errno((r0 >>> 0));
		}
		return errcode;
	};
	var SetFileCompletionNotificationModes = go$pkg.SetFileCompletionNotificationModes = function(handle, flags) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procSetFileCompletionNotificationModes.Addr(), 2, (handle >>> 0), (flags >>> 0), 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var WSAEnumProtocols = go$pkg.WSAEnumProtocols = function(protocols, protocolBuffer, bufferLength) {
		var n, err, _tuple, _array, _struct, _view, r0, e1;
		n = 0;
		err = null;
		_array = new Uint8Array(628);
		_tuple = Syscall(procWSAEnumProtocolsW.Addr(), 3, protocols, _array, bufferLength), r0 = _tuple[0], e1 = _tuple[2];
		_struct = protocolBuffer, _view = new DataView(_array.buffer, _array.byteOffset), _struct.ServiceFlags1 = _view.getUint32(0, true), _struct.ServiceFlags2 = _view.getUint32(4, true), _struct.ServiceFlags3 = _view.getUint32(8, true), _struct.ServiceFlags4 = _view.getUint32(12, true), _struct.ProviderFlags = _view.getUint32(16, true), _struct.ProviderId.Data1 = _view.getUint32(20, true), _struct.ProviderId.Data2 = _view.getUint16(24, true), _struct.ProviderId.Data3 = _view.getUint16(26, true), _struct.ProviderId.Data4 = new (go$nativeArray("Uint8"))(_array.buffer, go$min(_array.byteOffset + 28, _array.buffer.byteLength)), _struct.CatalogEntryId = _view.getUint32(36, true), _struct.ProtocolChain.ChainLen = _view.getInt32(40, true), _struct.ProtocolChain.ChainEntries = new (go$nativeArray("Uint32"))(_array.buffer, go$min(_array.byteOffset + 44, _array.buffer.byteLength)), _struct.Version = _view.getInt32(72, true), _struct.AddressFamily = _view.getInt32(76, true), _struct.MaxSockAddr = _view.getInt32(80, true), _struct.MinSockAddr = _view.getInt32(84, true), _struct.SocketType = _view.getInt32(88, true), _struct.Protocol = _view.getInt32(92, true), _struct.ProtocolMaxOffset = _view.getInt32(96, true), _struct.NetworkByteOrder = _view.getInt32(100, true), _struct.SecurityScheme = _view.getInt32(104, true), _struct.MessageSize = _view.getUint32(108, true), _struct.ProviderReserved = _view.getUint32(112, true), _struct.ProtocolName = new (go$nativeArray("Uint16"))(_array.buffer, go$min(_array.byteOffset + 116, _array.buffer.byteLength));
		n = (r0 >> 0);
		if (n === -1) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return [n, err];
	};
	var TranslateName = go$pkg.TranslateName = function(accName, accNameFormat, desiredNameFormat, translatedName, nSize) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall6(procTranslateNameW.Addr(), 5, accName, (accNameFormat >>> 0), (desiredNameFormat >>> 0), translatedName, nSize, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (((r1 & 255) >>> 0) === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var GetUserNameEx = go$pkg.GetUserNameEx = function(nameFormat, nameBuffre, nSize) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procGetUserNameExW.Addr(), 3, (nameFormat >>> 0), nameBuffre, nSize), r1 = _tuple[0], e1 = _tuple[2];
		if (((r1 & 255) >>> 0) === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var NetUserGetInfo = go$pkg.NetUserGetInfo = function(serverName, userName, level, buf) {
		var neterr, _tuple, r0;
		neterr = null;
		_tuple = Syscall6(procNetUserGetInfo.Addr(), 4, serverName, userName, (level >>> 0), buf, 0, 0), r0 = _tuple[0];
		if (!((r0 === 0))) {
			neterr = new Errno((r0 >>> 0));
		}
		return neterr;
	};
	var NetGetJoinInformation = go$pkg.NetGetJoinInformation = function(server, name, bufType) {
		var neterr, _tuple, r0;
		neterr = null;
		_tuple = Syscall(procNetGetJoinInformation.Addr(), 3, server, name, bufType), r0 = _tuple[0];
		if (!((r0 === 0))) {
			neterr = new Errno((r0 >>> 0));
		}
		return neterr;
	};
	var NetApiBufferFree = go$pkg.NetApiBufferFree = function(buf) {
		var neterr, _tuple, r0;
		neterr = null;
		_tuple = Syscall(procNetApiBufferFree.Addr(), 1, buf, 0, 0), r0 = _tuple[0];
		if (!((r0 === 0))) {
			neterr = new Errno((r0 >>> 0));
		}
		return neterr;
	};
	var LookupAccountSid = go$pkg.LookupAccountSid = function(systemName, sid, name, nameLen, refdDomainName, refdDomainNameLen, use) {
		var err, _tuple, _array, _struct, _view, r1, e1;
		err = null;
		_array = new Uint8Array(0);
		_tuple = Syscall9(procLookupAccountSidW.Addr(), 7, systemName, _array, name, nameLen, refdDomainName, refdDomainNameLen, use, 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		_struct = sid, _view = new DataView(_array.buffer, _array.byteOffset);
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var LookupAccountName = go$pkg.LookupAccountName = function(systemName, accountName, sid, sidLen, refdDomainName, refdDomainNameLen, use) {
		var err, _tuple, _array, _struct, _view, r1, e1;
		err = null;
		_array = new Uint8Array(0);
		_tuple = Syscall9(procLookupAccountNameW.Addr(), 7, systemName, accountName, _array, sidLen, refdDomainName, refdDomainNameLen, use, 0, 0), r1 = _tuple[0], e1 = _tuple[2];
		_struct = sid, _view = new DataView(_array.buffer, _array.byteOffset);
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var ConvertSidToStringSid = go$pkg.ConvertSidToStringSid = function(sid, stringSid) {
		var err, _tuple, _array, _struct, _view, r1, e1;
		err = null;
		_array = new Uint8Array(0);
		_tuple = Syscall(procConvertSidToStringSidW.Addr(), 2, _array, stringSid, 0), r1 = _tuple[0], e1 = _tuple[2];
		_struct = sid, _view = new DataView(_array.buffer, _array.byteOffset);
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var ConvertStringSidToSid = go$pkg.ConvertStringSidToSid = function(stringSid, sid) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procConvertStringSidToSidW.Addr(), 2, stringSid, sid, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var GetLengthSid = go$pkg.GetLengthSid = function(sid) {
		var len, _tuple, _array, _struct, _view, r0;
		len = 0;
		_array = new Uint8Array(0);
		_tuple = Syscall(procGetLengthSid.Addr(), 1, _array, 0, 0), r0 = _tuple[0];
		_struct = sid, _view = new DataView(_array.buffer, _array.byteOffset);
		len = (r0 >>> 0);
		return len;
	};
	var CopySid = go$pkg.CopySid = function(destSidLen, destSid, srcSid) {
		var err, _tuple, _array, _struct, _view, _array$1, _struct$1, _view$1, r1, e1;
		err = null;
		_array = new Uint8Array(0);
		_array$1 = new Uint8Array(0);
		_struct = destSid, _view = new DataView(_array.buffer, _array.byteOffset);
		_tuple = Syscall(procCopySid.Addr(), 3, (destSidLen >>> 0), _array, _array$1), r1 = _tuple[0], e1 = _tuple[2];
		_struct$1 = srcSid, _view$1 = new DataView(_array$1.buffer, _array$1.byteOffset);
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var OpenProcessToken = go$pkg.OpenProcessToken = function(h, access, token) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procOpenProcessToken.Addr(), 3, (h >>> 0), (access >>> 0), token), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var GetTokenInformation = go$pkg.GetTokenInformation = function(t, infoClass, info, infoLen, returnedLen) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall6(procGetTokenInformation.Addr(), 5, (t >>> 0), (infoClass >>> 0), info, (infoLen >>> 0), returnedLen, 0), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	var GetUserProfileDirectory = go$pkg.GetUserProfileDirectory = function(t, dir, dirLen) {
		var err, _tuple, r1, e1;
		err = null;
		_tuple = Syscall(procGetUserProfileDirectoryW.Addr(), 3, (t >>> 0), dir, dirLen), r1 = _tuple[0], e1 = _tuple[2];
		if (r1 === 0) {
			if (!((e1 === 0))) {
				err = new Errno(e1);
			} else {
				err = new Errno(536870951);
			}
		}
		return err;
	};
	Timeval.Ptr.prototype.Nanoseconds = function() {
		var tv, x, x$1;
		tv = this;
		return go$mul64(((x = go$mul64(new Go$Int64(0, tv.Sec), new Go$Int64(0, 1000000)), x$1 = new Go$Int64(0, tv.Usec), new Go$Int64(x.high + x$1.high, x.low + x$1.low))), new Go$Int64(0, 1000));
	};
	Timeval.prototype.Nanoseconds = function() { return this.go$val.Nanoseconds(); };
	var NsecToTimeval = go$pkg.NsecToTimeval = function(nsec) {
		var tv, x, x$1, _struct;
		tv = new Timeval.Ptr();
		tv.Sec = ((x = go$div64(nsec, new Go$Int64(0, 1000000000), false), x.low + ((x.high >> 31) * 4294967296)) >> 0);
		tv.Usec = ((x$1 = go$div64(go$div64(nsec, new Go$Int64(0, 1000000000), true), new Go$Int64(0, 1000), false), x$1.low + ((x$1.high >> 31) * 4294967296)) >> 0);
		return (_struct = tv, new Timeval.Ptr(_struct.Sec, _struct.Usec));
	};
	Filetime.Ptr.prototype.Nanoseconds = function() {
		var ft, x, x$1, nsec;
		ft = this;
		nsec = (x = go$shiftLeft64(new Go$Int64(0, ft.HighDateTime), 32), x$1 = new Go$Int64(0, ft.LowDateTime), new Go$Int64(x.high + x$1.high, x.low + x$1.low));
		nsec = new Go$Int64(nsec.high - 27111902, nsec.low - 3577643008);
		nsec = go$mul64(nsec, new Go$Int64(0, 100));
		return nsec;
	};
	Filetime.prototype.Nanoseconds = function() { return this.go$val.Nanoseconds(); };
	var NsecToFiletime = go$pkg.NsecToFiletime = function(nsec) {
		var ft, x, _struct, _struct$1;
		ft = new Filetime.Ptr();
		nsec = go$div64(nsec, new Go$Int64(0, 100), false);
		nsec = new Go$Int64(nsec.high + 27111902, nsec.low + 3577643008);
		ft.LowDateTime = (new Go$Int64(nsec.high & 0, (nsec.low & 4294967295) >>> 0).low >>> 0);
		ft.HighDateTime = ((x = go$shiftRightInt64(nsec, 32), new Go$Int64(x.high & 0, (x.low & 4294967295) >>> 0)).low >>> 0);
		ft = (_struct = ft, new Filetime.Ptr(_struct.LowDateTime, _struct.HighDateTime));
		return (_struct$1 = ft, new Filetime.Ptr(_struct$1.LowDateTime, _struct$1.HighDateTime));
	};
	var copyFindData = function(dst, src) {
		var _struct, _struct$1, _struct$2;
		dst.FileAttributes = src.FileAttributes;
		dst.CreationTime = (_struct = src.CreationTime, new Filetime.Ptr(_struct.LowDateTime, _struct.HighDateTime));
		dst.LastAccessTime = (_struct$1 = src.LastAccessTime, new Filetime.Ptr(_struct$1.LowDateTime, _struct$1.HighDateTime));
		dst.LastWriteTime = (_struct$2 = src.LastWriteTime, new Filetime.Ptr(_struct$2.LowDateTime, _struct$2.HighDateTime));
		dst.FileSizeHigh = src.FileSizeHigh;
		dst.FileSizeLow = src.FileSizeLow;
		dst.Reserved0 = src.Reserved0;
		dst.Reserved1 = src.Reserved1;
		go$copySlice(new (go$sliceType(Go$Uint16))(dst.FileName), new (go$sliceType(Go$Uint16))(src.FileName));
		go$copySlice(new (go$sliceType(Go$Uint16))(dst.AlternateFileName), new (go$sliceType(Go$Uint16))(src.AlternateFileName));
	};
	go$pkg.init = function() {
		go$pkg.ForkLock = new sync.RWMutex.Ptr();
		zeroProcAttr = new ProcAttr.Ptr();
		zeroSysProcAttr = new SysProcAttr.Ptr();
		_zero = 0;
		ioSync = new Go$Int64(0, 0);
		go$pkg.SocketDisableIPv6 = false;
		connectExFunc = new (go$structType([["once", "syscall", sync.Once, ""], ["addr", "syscall", Go$Uintptr, ""], ["err", "syscall", go$error, ""]])).Ptr(new sync.Once.Ptr(), 0, null);

			if (go$pkg.Syscall15 !== undefined) { // windows
				Syscall = Syscall6 = Syscall9 = Syscall12 = Syscall15 = go$pkg.Syscall = go$pkg.Syscall6 = go$pkg.Syscall9 = go$pkg.Syscall12 = go$pkg.Syscall15 = loadlibrary = getprocaddress = function() { throw "Syscalls not available." };
				getStdHandle = GetCommandLine = go$pkg.GetCommandLine = function() {};
				CommandLineToArgv = go$pkg.CommandLineToArgv = function() { return [null, {}]; };
				Getenv = go$pkg.Getenv = function(key) { return ["", false]; };
				GetTimeZoneInformation = go$pkg.GetTimeZoneInformation = function() { return [undefined, true]; };
			} else if (typeof process === "undefined") {
				go$pkg.go$setSyscall = function(f) {
					Syscall = Syscall6 = RawSyscall = RawSyscall6 = go$pkg.Syscall = go$pkg.Syscall6 = go$pkg.RawSyscall = go$pkg.RawSyscall6 = f;
				}
				go$pkg.go$setSyscall(function() { throw "Syscalls not available." });
				envs = new (go$sliceType(Go$String))(new Array(0));
			} else {
				var syscall = require("syscall");
				Syscall = go$pkg.Syscall = syscall.Syscall;
				Syscall6 = go$pkg.Syscall6 = syscall.Syscall6;
				RawSyscall = go$pkg.RawSyscall = syscall.Syscall;
				RawSyscall6 = go$pkg.RawSyscall6 = syscall.Syscall6;
				BytePtrFromString = go$pkg.BytePtrFromString = function(s) { return [go$stringToBytes(s, true), null]; };

				var envkeys = Object.keys(process.env);
				envs = new (go$sliceType(Go$String))(new Array(envkeys.length));
				var i;
				for(i = 0; i < envkeys.length; i++) {
					envs.array[i] = envkeys[i] + "=" + process.env[envkeys[i]];
				}
			}
				modkernel32 = NewLazyDLL("kernel32.dll");
		procSetHandleInformation = modkernel32.NewProc("SetHandleInformation");
		procGetStdHandle = modkernel32.NewProc("GetStdHandle");
		go$pkg.Stdin = getStdHandle(-10);
		go$pkg.Stdout = getStdHandle(-11);
		go$pkg.Stderr = getStdHandle(-12);
		errors = go$toNativeArray("String", ["argument list too long", "permission denied", "address already in use", "cannot assign requested address", "advertise error", "address family not supported by protocol", "resource temporarily unavailable", "operation already in progress", "invalid exchange", "bad file descriptor", "file descriptor in bad state", "bad message", "invalid request descriptor", "invalid request code", "invalid slot", "bad font file format", "device or resource busy", "operation canceled", "no child processes", "channel number out of range", "communication error on send", "software caused connection abort", "connection refused", "connection reset by peer", "resource deadlock avoided", "resource deadlock avoided", "destination address required", "numerical argument out of domain", "RFS specific error", "disk quota exceeded", "file exists", "bad address", "file too large", "host is down", "no route to host", "identifier removed", "invalid or incomplete multibyte or wide character", "operation now in progress", "interrupted system call", "invalid argument", "input/output error", "transport endpoint is already connected", "is a directory", "is a named type file", "key has expired", "key was rejected by service", "key has been revoked", "level 2 halted", "level 2 not synchronized", "level 3 halted", "level 3 reset", "can not access a needed shared library", "accessing a corrupted shared library", "cannot exec a shared library directly", "attempting to link in too many shared libraries", ".lib section in a.out corrupted", "link number out of range", "too many levels of symbolic links", "wrong medium type", "too many open files", "too many links", "message too long", "multihop attempted", "file name too long", "no XENIX semaphores available", "network is down", "network dropped connection on reset", "network is unreachable", "too many open files in system", "no anode", "no buffer space available", "no CSI structure available", "no data available", "no such device", "exec format error", "required key not available", "no locks available", "link has been severed", "no medium found", "cannot allocate memory", "no message of desired type", "machine is not on the network", "package not installed", "protocol not available", "no space left on device", "out of streams resources", "device not a stream", "function not implemented", "block device required", "transport endpoint is not connected", "directory not empty", "not a XENIX named type file", "state not recoverable", "socket operation on non-socket", "operation not supported", "inappropriate ioctl for device", "name not unique on network", "no such device or address", "operation not supported", "value too large for defined data type", "owner died", "operation not permitted", "protocol family not supported", "broken pipe", "protocol error", "protocol not supported", "protocol wrong type for socket", "numerical result out of range", "remote address changed", "object is remote", "remote I/O error", "interrupted system call should be restarted", "read-only file system", "cannot send after transport endpoint shutdown", "socket type not supported", "illegal seek", "no such process", "srmount error", "stale NFS file handle", "streams pipe error", "timer expired", "connection timed out", "too many references: cannot splice", "text file busy", "structure needs cleaning", "protocol driver not attached", "too many users", "resource temporarily unavailable", "invalid cross-device link", "exchange full", "not supported by windows"]);
		modadvapi32 = NewLazyDLL("advapi32.dll");
		modshell32 = NewLazyDLL("shell32.dll");
		modmswsock = NewLazyDLL("mswsock.dll");
		modcrypt32 = NewLazyDLL("crypt32.dll");
		modws2_32 = NewLazyDLL("ws2_32.dll");
		moddnsapi = NewLazyDLL("dnsapi.dll");
		modiphlpapi = NewLazyDLL("iphlpapi.dll");
		modsecur32 = NewLazyDLL("secur32.dll");
		modnetapi32 = NewLazyDLL("netapi32.dll");
		moduserenv = NewLazyDLL("userenv.dll");
		procGetLastError = modkernel32.NewProc("GetLastError");
		procLoadLibraryW = modkernel32.NewProc("LoadLibraryW");
		procFreeLibrary = modkernel32.NewProc("FreeLibrary");
		procGetProcAddress = modkernel32.NewProc("GetProcAddress");
		procGetVersion = modkernel32.NewProc("GetVersion");
		procFormatMessageW = modkernel32.NewProc("FormatMessageW");
		procExitProcess = modkernel32.NewProc("ExitProcess");
		procCreateFileW = modkernel32.NewProc("CreateFileW");
		procReadFile = modkernel32.NewProc("ReadFile");
		procWriteFile = modkernel32.NewProc("WriteFile");
		procSetFilePointer = modkernel32.NewProc("SetFilePointer");
		procCloseHandle = modkernel32.NewProc("CloseHandle");
		procFindFirstFileW = modkernel32.NewProc("FindFirstFileW");
		procFindNextFileW = modkernel32.NewProc("FindNextFileW");
		procFindClose = modkernel32.NewProc("FindClose");
		procGetFileInformationByHandle = modkernel32.NewProc("GetFileInformationByHandle");
		procGetCurrentDirectoryW = modkernel32.NewProc("GetCurrentDirectoryW");
		procSetCurrentDirectoryW = modkernel32.NewProc("SetCurrentDirectoryW");
		procCreateDirectoryW = modkernel32.NewProc("CreateDirectoryW");
		procRemoveDirectoryW = modkernel32.NewProc("RemoveDirectoryW");
		procDeleteFileW = modkernel32.NewProc("DeleteFileW");
		procMoveFileW = modkernel32.NewProc("MoveFileW");
		procGetComputerNameW = modkernel32.NewProc("GetComputerNameW");
		procSetEndOfFile = modkernel32.NewProc("SetEndOfFile");
		procGetSystemTimeAsFileTime = modkernel32.NewProc("GetSystemTimeAsFileTime");
		procGetTimeZoneInformation = modkernel32.NewProc("GetTimeZoneInformation");
		procCreateIoCompletionPort = modkernel32.NewProc("CreateIoCompletionPort");
		procGetQueuedCompletionStatus = modkernel32.NewProc("GetQueuedCompletionStatus");
		procPostQueuedCompletionStatus = modkernel32.NewProc("PostQueuedCompletionStatus");
		procCancelIo = modkernel32.NewProc("CancelIo");
		procCancelIoEx = modkernel32.NewProc("CancelIoEx");
		procCreateProcessW = modkernel32.NewProc("CreateProcessW");
		procOpenProcess = modkernel32.NewProc("OpenProcess");
		procTerminateProcess = modkernel32.NewProc("TerminateProcess");
		procGetExitCodeProcess = modkernel32.NewProc("GetExitCodeProcess");
		procGetStartupInfoW = modkernel32.NewProc("GetStartupInfoW");
		procGetCurrentProcess = modkernel32.NewProc("GetCurrentProcess");
		procGetProcessTimes = modkernel32.NewProc("GetProcessTimes");
		procDuplicateHandle = modkernel32.NewProc("DuplicateHandle");
		procWaitForSingleObject = modkernel32.NewProc("WaitForSingleObject");
		procGetTempPathW = modkernel32.NewProc("GetTempPathW");
		procCreatePipe = modkernel32.NewProc("CreatePipe");
		procGetFileType = modkernel32.NewProc("GetFileType");
		procCryptAcquireContextW = modadvapi32.NewProc("CryptAcquireContextW");
		procCryptReleaseContext = modadvapi32.NewProc("CryptReleaseContext");
		procCryptGenRandom = modadvapi32.NewProc("CryptGenRandom");
		procGetEnvironmentStringsW = modkernel32.NewProc("GetEnvironmentStringsW");
		procFreeEnvironmentStringsW = modkernel32.NewProc("FreeEnvironmentStringsW");
		procGetEnvironmentVariableW = modkernel32.NewProc("GetEnvironmentVariableW");
		procSetEnvironmentVariableW = modkernel32.NewProc("SetEnvironmentVariableW");
		procSetFileTime = modkernel32.NewProc("SetFileTime");
		procGetFileAttributesW = modkernel32.NewProc("GetFileAttributesW");
		procSetFileAttributesW = modkernel32.NewProc("SetFileAttributesW");
		procGetFileAttributesExW = modkernel32.NewProc("GetFileAttributesExW");
		procGetCommandLineW = modkernel32.NewProc("GetCommandLineW");
		procCommandLineToArgvW = modshell32.NewProc("CommandLineToArgvW");
		procLocalFree = modkernel32.NewProc("LocalFree");
		procFlushFileBuffers = modkernel32.NewProc("FlushFileBuffers");
		procGetFullPathNameW = modkernel32.NewProc("GetFullPathNameW");
		procGetLongPathNameW = modkernel32.NewProc("GetLongPathNameW");
		procGetShortPathNameW = modkernel32.NewProc("GetShortPathNameW");
		procCreateFileMappingW = modkernel32.NewProc("CreateFileMappingW");
		procMapViewOfFile = modkernel32.NewProc("MapViewOfFile");
		procUnmapViewOfFile = modkernel32.NewProc("UnmapViewOfFile");
		procFlushViewOfFile = modkernel32.NewProc("FlushViewOfFile");
		procVirtualLock = modkernel32.NewProc("VirtualLock");
		procVirtualUnlock = modkernel32.NewProc("VirtualUnlock");
		procTransmitFile = modmswsock.NewProc("TransmitFile");
		procReadDirectoryChangesW = modkernel32.NewProc("ReadDirectoryChangesW");
		procCertOpenSystemStoreW = modcrypt32.NewProc("CertOpenSystemStoreW");
		procCertOpenStore = modcrypt32.NewProc("CertOpenStore");
		procCertEnumCertificatesInStore = modcrypt32.NewProc("CertEnumCertificatesInStore");
		procCertAddCertificateContextToStore = modcrypt32.NewProc("CertAddCertificateContextToStore");
		procCertCloseStore = modcrypt32.NewProc("CertCloseStore");
		procCertGetCertificateChain = modcrypt32.NewProc("CertGetCertificateChain");
		procCertFreeCertificateChain = modcrypt32.NewProc("CertFreeCertificateChain");
		procCertCreateCertificateContext = modcrypt32.NewProc("CertCreateCertificateContext");
		procCertFreeCertificateContext = modcrypt32.NewProc("CertFreeCertificateContext");
		procCertVerifyCertificateChainPolicy = modcrypt32.NewProc("CertVerifyCertificateChainPolicy");
		procRegOpenKeyExW = modadvapi32.NewProc("RegOpenKeyExW");
		procRegCloseKey = modadvapi32.NewProc("RegCloseKey");
		procRegQueryInfoKeyW = modadvapi32.NewProc("RegQueryInfoKeyW");
		procRegEnumKeyExW = modadvapi32.NewProc("RegEnumKeyExW");
		procRegQueryValueExW = modadvapi32.NewProc("RegQueryValueExW");
		procGetCurrentProcessId = modkernel32.NewProc("GetCurrentProcessId");
		procGetConsoleMode = modkernel32.NewProc("GetConsoleMode");
		procWriteConsoleW = modkernel32.NewProc("WriteConsoleW");
		procReadConsoleW = modkernel32.NewProc("ReadConsoleW");
		procWSAStartup = modws2_32.NewProc("WSAStartup");
		procWSACleanup = modws2_32.NewProc("WSACleanup");
		procWSAIoctl = modws2_32.NewProc("WSAIoctl");
		procsocket = modws2_32.NewProc("socket");
		procsetsockopt = modws2_32.NewProc("setsockopt");
		procgetsockopt = modws2_32.NewProc("getsockopt");
		procbind = modws2_32.NewProc("bind");
		procconnect = modws2_32.NewProc("connect");
		procgetsockname = modws2_32.NewProc("getsockname");
		procgetpeername = modws2_32.NewProc("getpeername");
		proclisten = modws2_32.NewProc("listen");
		procshutdown = modws2_32.NewProc("shutdown");
		procclosesocket = modws2_32.NewProc("closesocket");
		procAcceptEx = modmswsock.NewProc("AcceptEx");
		procGetAcceptExSockaddrs = modmswsock.NewProc("GetAcceptExSockaddrs");
		procWSARecv = modws2_32.NewProc("WSARecv");
		procWSASend = modws2_32.NewProc("WSASend");
		procWSARecvFrom = modws2_32.NewProc("WSARecvFrom");
		procWSASendTo = modws2_32.NewProc("WSASendTo");
		procgethostbyname = modws2_32.NewProc("gethostbyname");
		procgetservbyname = modws2_32.NewProc("getservbyname");
		procntohs = modws2_32.NewProc("ntohs");
		procgetprotobyname = modws2_32.NewProc("getprotobyname");
		procDnsQuery_W = moddnsapi.NewProc("DnsQuery_W");
		procDnsRecordListFree = moddnsapi.NewProc("DnsRecordListFree");
		procGetAddrInfoW = modws2_32.NewProc("GetAddrInfoW");
		procFreeAddrInfoW = modws2_32.NewProc("FreeAddrInfoW");
		procGetIfEntry = modiphlpapi.NewProc("GetIfEntry");
		procGetAdaptersInfo = modiphlpapi.NewProc("GetAdaptersInfo");
		procSetFileCompletionNotificationModes = modkernel32.NewProc("SetFileCompletionNotificationModes");
		procWSAEnumProtocolsW = modws2_32.NewProc("WSAEnumProtocolsW");
		procTranslateNameW = modsecur32.NewProc("TranslateNameW");
		procGetUserNameExW = modsecur32.NewProc("GetUserNameExW");
		procNetUserGetInfo = modnetapi32.NewProc("NetUserGetInfo");
		procNetGetJoinInformation = modnetapi32.NewProc("NetGetJoinInformation");
		procNetApiBufferFree = modnetapi32.NewProc("NetApiBufferFree");
		procLookupAccountSidW = modadvapi32.NewProc("LookupAccountSidW");
		procLookupAccountNameW = modadvapi32.NewProc("LookupAccountNameW");
		procConvertSidToStringSidW = modadvapi32.NewProc("ConvertSidToStringSidW");
		procConvertStringSidToSidW = modadvapi32.NewProc("ConvertStringSidToSidW");
		procGetLengthSid = modadvapi32.NewProc("GetLengthSid");
		procCopySid = modadvapi32.NewProc("CopySid");
		procOpenProcessToken = modadvapi32.NewProc("OpenProcessToken");
		procGetTokenInformation = modadvapi32.NewProc("GetTokenInformation");
		procGetUserProfileDirectoryW = moduserenv.NewProc("GetUserProfileDirectoryW");
		signals = go$toNativeArray("String", ["", "hangup", "interrupt", "quit", "illegal instruction", "trace/breakpoint trap", "aborted", "bus error", "floating point exception", "killed", "user defined signal 1", "segmentation fault", "user defined signal 2", "broken pipe", "alarm clock", "terminated"]);
		go$pkg.OID_PKIX_KP_SERVER_AUTH = new (go$sliceType(Go$Uint8))(go$stringToBytes("1.3.6.1.5.5.7.3.1\x00"));
		go$pkg.OID_SERVER_GATED_CRYPTO = new (go$sliceType(Go$Uint8))(go$stringToBytes("1.3.6.1.4.1.311.10.3.3\x00"));
		go$pkg.OID_SGC_NETSCAPE = new (go$sliceType(Go$Uint8))(go$stringToBytes("2.16.840.1.113730.4.1\x00"));
		go$pkg.WSAID_CONNECTEX = new GUID.Ptr(631375801, 56819, 18016, go$toNativeArray("Uint8", [142, 233, 118, 229, 140, 116, 6, 62]));
	};
	return go$pkg;
})();
go$packages["time"] = (function() {
	var go$pkg = {};
	var errors = go$packages["errors"];
	var syscall = go$packages["syscall"];
	var sync = go$packages["sync"];
	var runtime = go$packages["runtime"];
	var ParseError;
	ParseError = go$newType(0, "Struct", "time.ParseError", "ParseError", "time", function(Layout_, Value_, LayoutElem_, ValueElem_, Message_) {
		this.go$val = this;
		this.Layout = Layout_ !== undefined ? Layout_ : "";
		this.Value = Value_ !== undefined ? Value_ : "";
		this.LayoutElem = LayoutElem_ !== undefined ? LayoutElem_ : "";
		this.ValueElem = ValueElem_ !== undefined ? ValueElem_ : "";
		this.Message = Message_ !== undefined ? Message_ : "";
	});
	go$pkg.ParseError = ParseError;
	var runtimeTimer;
	runtimeTimer = go$newType(0, "Struct", "time.runtimeTimer", "runtimeTimer", "time", function(i_, when_, period_, f_, arg_) {
		this.go$val = this;
		this.i = i_ !== undefined ? i_ : 0;
		this.when = when_ !== undefined ? when_ : new Go$Int64(0, 0);
		this.period = period_ !== undefined ? period_ : new Go$Int64(0, 0);
		this.f = f_ !== undefined ? f_ : go$throwNilPointerError;
		this.arg = arg_ !== undefined ? arg_ : null;
	});
	go$pkg.runtimeTimer = runtimeTimer;
	var Timer;
	Timer = go$newType(0, "Struct", "time.Timer", "Timer", "time", function(C_, r_) {
		this.go$val = this;
		this.C = C_ !== undefined ? C_ : (go$chanType(Time, false, true)).nil;
		this.r = r_ !== undefined ? r_ : new runtimeTimer.Ptr();
	});
	go$pkg.Timer = Timer;
	var Ticker;
	Ticker = go$newType(0, "Struct", "time.Ticker", "Ticker", "time", function(C_, r_) {
		this.go$val = this;
		this.C = C_ !== undefined ? C_ : (go$chanType(Time, false, true)).nil;
		this.r = r_ !== undefined ? r_ : new runtimeTimer.Ptr();
	});
	go$pkg.Ticker = Ticker;
	var Time;
	Time = go$newType(0, "Struct", "time.Time", "Time", "time", function(sec_, nsec_, loc_) {
		this.go$val = this;
		this.sec = sec_ !== undefined ? sec_ : new Go$Int64(0, 0);
		this.nsec = nsec_ !== undefined ? nsec_ : 0;
		this.loc = loc_ !== undefined ? loc_ : (go$ptrType(Location)).nil;
	});
	go$pkg.Time = Time;
	var Month;
	Month = go$newType(4, "Int", "time.Month", "Month", "time", null);
	go$pkg.Month = Month;
	var Weekday;
	Weekday = go$newType(4, "Int", "time.Weekday", "Weekday", "time", null);
	go$pkg.Weekday = Weekday;
	var Duration;
	Duration = go$newType(8, "Int64", "time.Duration", "Duration", "time", null);
	go$pkg.Duration = Duration;
	var Location;
	Location = go$newType(0, "Struct", "time.Location", "Location", "time", function(name_, zone_, tx_, cacheStart_, cacheEnd_, cacheZone_) {
		this.go$val = this;
		this.name = name_ !== undefined ? name_ : "";
		this.zone = zone_ !== undefined ? zone_ : (go$sliceType(zone)).nil;
		this.tx = tx_ !== undefined ? tx_ : (go$sliceType(zoneTrans)).nil;
		this.cacheStart = cacheStart_ !== undefined ? cacheStart_ : new Go$Int64(0, 0);
		this.cacheEnd = cacheEnd_ !== undefined ? cacheEnd_ : new Go$Int64(0, 0);
		this.cacheZone = cacheZone_ !== undefined ? cacheZone_ : (go$ptrType(zone)).nil;
	});
	go$pkg.Location = Location;
	var zone;
	zone = go$newType(0, "Struct", "time.zone", "zone", "time", function(name_, offset_, isDST_) {
		this.go$val = this;
		this.name = name_ !== undefined ? name_ : "";
		this.offset = offset_ !== undefined ? offset_ : 0;
		this.isDST = isDST_ !== undefined ? isDST_ : false;
	});
	go$pkg.zone = zone;
	var zoneTrans;
	zoneTrans = go$newType(0, "Struct", "time.zoneTrans", "zoneTrans", "time", function(when_, index_, isstd_, isutc_) {
		this.go$val = this;
		this.when = when_ !== undefined ? when_ : new Go$Int64(0, 0);
		this.index = index_ !== undefined ? index_ : 0;
		this.isstd = isstd_ !== undefined ? isstd_ : false;
		this.isutc = isutc_ !== undefined ? isutc_ : false;
	});
	go$pkg.zoneTrans = zoneTrans;
	var abbr;
	abbr = go$newType(0, "Struct", "time.abbr", "abbr", "time", function(std_, dst_) {
		this.go$val = this;
		this.std = std_ !== undefined ? std_ : "";
		this.dst = dst_ !== undefined ? dst_ : "";
	});
	go$pkg.abbr = abbr;
	var data;
	data = go$newType(0, "Struct", "time.data", "data", "time", function(p_, error_) {
		this.go$val = this;
		this.p = p_ !== undefined ? p_ : (go$sliceType(Go$Uint8)).nil;
		this.error = error_ !== undefined ? error_ : false;
	});
	go$pkg.data = data;
	ParseError.init([["Layout", "", Go$String, ""], ["Value", "", Go$String, ""], ["LayoutElem", "", Go$String, ""], ["ValueElem", "", Go$String, ""], ["Message", "", Go$String, ""]]);
	(go$ptrType(ParseError)).methods = [["Error", "", [], [Go$String], false]];
	runtimeTimer.init([["i", "time", Go$Int32, ""], ["when", "time", Go$Int64, ""], ["period", "time", Go$Int64, ""], ["f", "time", (go$funcType([Go$Int64, go$emptyInterface], [], false)), ""], ["arg", "time", go$emptyInterface, ""]]);
	Timer.init([["C", "", (go$chanType(Time, false, true)), ""], ["r", "time", runtimeTimer, ""]]);
	(go$ptrType(Timer)).methods = [["Reset", "", [Duration], [Go$Bool], false], ["Stop", "", [], [Go$Bool], false]];
	Ticker.init([["C", "", (go$chanType(Time, false, true)), ""], ["r", "time", runtimeTimer, ""]]);
	(go$ptrType(Ticker)).methods = [["Stop", "", [], [], false]];
	Time.init([["sec", "time", Go$Int64, ""], ["nsec", "time", Go$Uintptr, ""], ["loc", "time", (go$ptrType(Location)), ""]]);
	Time.methods = [["Add", "", [Duration], [Time], false], ["AddDate", "", [Go$Int, Go$Int, Go$Int], [Time], false], ["After", "", [Time], [Go$Bool], false], ["Before", "", [Time], [Go$Bool], false], ["Clock", "", [], [Go$Int, Go$Int, Go$Int], false], ["Date", "", [], [Go$Int, Month, Go$Int], false], ["Day", "", [], [Go$Int], false], ["Equal", "", [Time], [Go$Bool], false], ["Format", "", [Go$String], [Go$String], false], ["GobEncode", "", [], [(go$sliceType(Go$Uint8)), go$error], false], ["Hour", "", [], [Go$Int], false], ["ISOWeek", "", [], [Go$Int, Go$Int], false], ["In", "", [(go$ptrType(Location))], [Time], false], ["IsZero", "", [], [Go$Bool], false], ["Local", "", [], [Time], false], ["Location", "", [], [(go$ptrType(Location))], false], ["MarshalBinary", "", [], [(go$sliceType(Go$Uint8)), go$error], false], ["MarshalJSON", "", [], [(go$sliceType(Go$Uint8)), go$error], false], ["MarshalText", "", [], [(go$sliceType(Go$Uint8)), go$error], false], ["Minute", "", [], [Go$Int], false], ["Month", "", [], [Month], false], ["Nanosecond", "", [], [Go$Int], false], ["Round", "", [Duration], [Time], false], ["Second", "", [], [Go$Int], false], ["String", "", [], [Go$String], false], ["Sub", "", [Time], [Duration], false], ["Truncate", "", [Duration], [Time], false], ["UTC", "", [], [Time], false], ["Unix", "", [], [Go$Int64], false], ["UnixNano", "", [], [Go$Int64], false], ["Weekday", "", [], [Weekday], false], ["Year", "", [], [Go$Int], false], ["YearDay", "", [], [Go$Int], false], ["Zone", "", [], [Go$String, Go$Int], false], ["abs", "time", [], [Go$Uint64], false], ["date", "time", [Go$Bool], [Go$Int, Month, Go$Int, Go$Int], false], ["locabs", "time", [], [Go$String, Go$Int, Go$Uint64], false]];
	(go$ptrType(Time)).methods = [["Add", "", [Duration], [Time], false], ["AddDate", "", [Go$Int, Go$Int, Go$Int], [Time], false], ["After", "", [Time], [Go$Bool], false], ["Before", "", [Time], [Go$Bool], false], ["Clock", "", [], [Go$Int, Go$Int, Go$Int], false], ["Date", "", [], [Go$Int, Month, Go$Int], false], ["Day", "", [], [Go$Int], false], ["Equal", "", [Time], [Go$Bool], false], ["Format", "", [Go$String], [Go$String], false], ["GobDecode", "", [(go$sliceType(Go$Uint8))], [go$error], false], ["GobEncode", "", [], [(go$sliceType(Go$Uint8)), go$error], false], ["Hour", "", [], [Go$Int], false], ["ISOWeek", "", [], [Go$Int, Go$Int], false], ["In", "", [(go$ptrType(Location))], [Time], false], ["IsZero", "", [], [Go$Bool], false], ["Local", "", [], [Time], false], ["Location", "", [], [(go$ptrType(Location))], false], ["MarshalBinary", "", [], [(go$sliceType(Go$Uint8)), go$error], false], ["MarshalJSON", "", [], [(go$sliceType(Go$Uint8)), go$error], false], ["MarshalText", "", [], [(go$sliceType(Go$Uint8)), go$error], false], ["Minute", "", [], [Go$Int], false], ["Month", "", [], [Month], false], ["Nanosecond", "", [], [Go$Int], false], ["Round", "", [Duration], [Time], false], ["Second", "", [], [Go$Int], false], ["String", "", [], [Go$String], false], ["Sub", "", [Time], [Duration], false], ["Truncate", "", [Duration], [Time], false], ["UTC", "", [], [Time], false], ["Unix", "", [], [Go$Int64], false], ["UnixNano", "", [], [Go$Int64], false], ["UnmarshalBinary", "", [(go$sliceType(Go$Uint8))], [go$error], false], ["UnmarshalJSON", "", [(go$sliceType(Go$Uint8))], [go$error], false], ["UnmarshalText", "", [(go$sliceType(Go$Uint8))], [go$error], false], ["Weekday", "", [], [Weekday], false], ["Year", "", [], [Go$Int], false], ["YearDay", "", [], [Go$Int], false], ["Zone", "", [], [Go$String, Go$Int], false], ["abs", "time", [], [Go$Uint64], false], ["date", "time", [Go$Bool], [Go$Int, Month, Go$Int, Go$Int], false], ["locabs", "time", [], [Go$String, Go$Int, Go$Uint64], false]];
	Month.methods = [["String", "", [], [Go$String], false]];
	(go$ptrType(Month)).methods = [["String", "", [], [Go$String], false]];
	Weekday.methods = [["String", "", [], [Go$String], false]];
	(go$ptrType(Weekday)).methods = [["String", "", [], [Go$String], false]];
	Duration.methods = [["Hours", "", [], [Go$Float64], false], ["Minutes", "", [], [Go$Float64], false], ["Nanoseconds", "", [], [Go$Int64], false], ["Seconds", "", [], [Go$Float64], false], ["String", "", [], [Go$String], false]];
	(go$ptrType(Duration)).methods = [["Hours", "", [], [Go$Float64], false], ["Minutes", "", [], [Go$Float64], false], ["Nanoseconds", "", [], [Go$Int64], false], ["Seconds", "", [], [Go$Float64], false], ["String", "", [], [Go$String], false]];
	Location.init([["name", "time", Go$String, ""], ["zone", "time", (go$sliceType(zone)), ""], ["tx", "time", (go$sliceType(zoneTrans)), ""], ["cacheStart", "time", Go$Int64, ""], ["cacheEnd", "time", Go$Int64, ""], ["cacheZone", "time", (go$ptrType(zone)), ""]]);
	(go$ptrType(Location)).methods = [["String", "", [], [Go$String], false], ["get", "time", [], [(go$ptrType(Location))], false], ["lookup", "time", [Go$Int64], [Go$String, Go$Int, Go$Bool, Go$Int64, Go$Int64], false], ["lookupName", "time", [Go$String, Go$Int64], [Go$Int, Go$Bool, Go$Bool], false]];
	zone.init([["name", "time", Go$String, ""], ["offset", "time", Go$Int, ""], ["isDST", "time", Go$Bool, ""]]);
	zoneTrans.init([["when", "time", Go$Int64, ""], ["index", "time", Go$Uint8, ""], ["isstd", "time", Go$Bool, ""], ["isutc", "time", Go$Bool, ""]]);
	abbr.init([["std", "time", Go$String, ""], ["dst", "time", Go$String, ""]]);
	data.init([["p", "time", (go$sliceType(Go$Uint8)), ""], ["error", "time", Go$Bool, ""]]);
	(go$ptrType(data)).methods = [["big4", "time", [], [Go$Uint32, Go$Bool], false], ["byte", "time", [], [Go$Uint8, Go$Bool], false], ["read", "time", [Go$Int], [(go$sliceType(Go$Uint8))], false]];
	var std0x, longDayNames, shortDayNames, shortMonthNames, longMonthNames, atoiError, errBad, errLeadingInt, unitMap, months, days, daysBefore, utcLoc, localLoc, localOnce, zoneinfo, abbrs, badData, usPacific, aus;
	var startsWithLowerCase = function(str) {
		var c;
		if (str.length === 0) {
			return false;
		}
		c = str.charCodeAt(0);
		return 97 <= c && c <= 122;
	};
	var nextStdChunk = function(layout) {
		var prefix, std, suffix, i, c, _ref, _tuple, _tuple$1, _tuple$2, _tuple$3, _tuple$4, _tuple$5, _tuple$6, _tuple$7, _tuple$8, _tuple$9, _tuple$10, _tuple$11, _tuple$12, _tuple$13, _tuple$14, _tuple$15, _tuple$16, _tuple$17, _tuple$18, _tuple$19, _tuple$20, _tuple$21, _tuple$22, _tuple$23, _tuple$24, ch, j, std$1, _tuple$25, _tuple$26;
		prefix = "";
		std = 0;
		suffix = "";
		i = 0;
		while (i < layout.length) {
			c = (layout.charCodeAt(i) >> 0);
			_ref = c;
			if (_ref === 74) {
				if (layout.length >= (i + 3 >> 0) && layout.substring(i, (i + 3 >> 0)) === "Jan") {
					if (layout.length >= (i + 7 >> 0) && layout.substring(i, (i + 7 >> 0)) === "January") {
						_tuple = [layout.substring(0, i), 257, layout.substring((i + 7 >> 0))], prefix = _tuple[0], std = _tuple[1], suffix = _tuple[2];
						return [prefix, std, suffix];
					}
					if (!startsWithLowerCase(layout.substring((i + 3 >> 0)))) {
						_tuple$1 = [layout.substring(0, i), 258, layout.substring((i + 3 >> 0))], prefix = _tuple$1[0], std = _tuple$1[1], suffix = _tuple$1[2];
						return [prefix, std, suffix];
					}
				}
			} else if (_ref === 77) {
				if (layout.length >= (i + 3 >> 0)) {
					if (layout.substring(i, (i + 3 >> 0)) === "Mon") {
						if (layout.length >= (i + 6 >> 0) && layout.substring(i, (i + 6 >> 0)) === "Monday") {
							_tuple$2 = [layout.substring(0, i), 261, layout.substring((i + 6 >> 0))], prefix = _tuple$2[0], std = _tuple$2[1], suffix = _tuple$2[2];
							return [prefix, std, suffix];
						}
						if (!startsWithLowerCase(layout.substring((i + 3 >> 0)))) {
							_tuple$3 = [layout.substring(0, i), 262, layout.substring((i + 3 >> 0))], prefix = _tuple$3[0], std = _tuple$3[1], suffix = _tuple$3[2];
							return [prefix, std, suffix];
						}
					}
					if (layout.substring(i, (i + 3 >> 0)) === "MST") {
						_tuple$4 = [layout.substring(0, i), 21, layout.substring((i + 3 >> 0))], prefix = _tuple$4[0], std = _tuple$4[1], suffix = _tuple$4[2];
						return [prefix, std, suffix];
					}
				}
			} else if (_ref === 48) {
				if (layout.length >= (i + 2 >> 0) && 49 <= layout.charCodeAt((i + 1 >> 0)) && layout.charCodeAt((i + 1 >> 0)) <= 54) {
					_tuple$5 = [layout.substring(0, i), std0x[(layout.charCodeAt((i + 1 >> 0)) - 49 << 24 >>> 24)], layout.substring((i + 2 >> 0))], prefix = _tuple$5[0], std = _tuple$5[1], suffix = _tuple$5[2];
					return [prefix, std, suffix];
				}
			} else if (_ref === 49) {
				if (layout.length >= (i + 2 >> 0) && (layout.charCodeAt((i + 1 >> 0)) === 53)) {
					_tuple$6 = [layout.substring(0, i), 522, layout.substring((i + 2 >> 0))], prefix = _tuple$6[0], std = _tuple$6[1], suffix = _tuple$6[2];
					return [prefix, std, suffix];
				}
				_tuple$7 = [layout.substring(0, i), 259, layout.substring((i + 1 >> 0))], prefix = _tuple$7[0], std = _tuple$7[1], suffix = _tuple$7[2];
				return [prefix, std, suffix];
			} else if (_ref === 50) {
				if (layout.length >= (i + 4 >> 0) && layout.substring(i, (i + 4 >> 0)) === "2006") {
					_tuple$8 = [layout.substring(0, i), 273, layout.substring((i + 4 >> 0))], prefix = _tuple$8[0], std = _tuple$8[1], suffix = _tuple$8[2];
					return [prefix, std, suffix];
				}
				_tuple$9 = [layout.substring(0, i), 263, layout.substring((i + 1 >> 0))], prefix = _tuple$9[0], std = _tuple$9[1], suffix = _tuple$9[2];
				return [prefix, std, suffix];
			} else if (_ref === 95) {
				if (layout.length >= (i + 2 >> 0) && (layout.charCodeAt((i + 1 >> 0)) === 50)) {
					_tuple$10 = [layout.substring(0, i), 264, layout.substring((i + 2 >> 0))], prefix = _tuple$10[0], std = _tuple$10[1], suffix = _tuple$10[2];
					return [prefix, std, suffix];
				}
			} else if (_ref === 51) {
				_tuple$11 = [layout.substring(0, i), 523, layout.substring((i + 1 >> 0))], prefix = _tuple$11[0], std = _tuple$11[1], suffix = _tuple$11[2];
				return [prefix, std, suffix];
			} else if (_ref === 52) {
				_tuple$12 = [layout.substring(0, i), 525, layout.substring((i + 1 >> 0))], prefix = _tuple$12[0], std = _tuple$12[1], suffix = _tuple$12[2];
				return [prefix, std, suffix];
			} else if (_ref === 53) {
				_tuple$13 = [layout.substring(0, i), 527, layout.substring((i + 1 >> 0))], prefix = _tuple$13[0], std = _tuple$13[1], suffix = _tuple$13[2];
				return [prefix, std, suffix];
			} else if (_ref === 80) {
				if (layout.length >= (i + 2 >> 0) && (layout.charCodeAt((i + 1 >> 0)) === 77)) {
					_tuple$14 = [layout.substring(0, i), 531, layout.substring((i + 2 >> 0))], prefix = _tuple$14[0], std = _tuple$14[1], suffix = _tuple$14[2];
					return [prefix, std, suffix];
				}
			} else if (_ref === 112) {
				if (layout.length >= (i + 2 >> 0) && (layout.charCodeAt((i + 1 >> 0)) === 109)) {
					_tuple$15 = [layout.substring(0, i), 532, layout.substring((i + 2 >> 0))], prefix = _tuple$15[0], std = _tuple$15[1], suffix = _tuple$15[2];
					return [prefix, std, suffix];
				}
			} else if (_ref === 45) {
				if (layout.length >= (i + 7 >> 0) && layout.substring(i, (i + 7 >> 0)) === "-070000") {
					_tuple$16 = [layout.substring(0, i), 27, layout.substring((i + 7 >> 0))], prefix = _tuple$16[0], std = _tuple$16[1], suffix = _tuple$16[2];
					return [prefix, std, suffix];
				}
				if (layout.length >= (i + 9 >> 0) && layout.substring(i, (i + 9 >> 0)) === "-07:00:00") {
					_tuple$17 = [layout.substring(0, i), 30, layout.substring((i + 9 >> 0))], prefix = _tuple$17[0], std = _tuple$17[1], suffix = _tuple$17[2];
					return [prefix, std, suffix];
				}
				if (layout.length >= (i + 5 >> 0) && layout.substring(i, (i + 5 >> 0)) === "-0700") {
					_tuple$18 = [layout.substring(0, i), 26, layout.substring((i + 5 >> 0))], prefix = _tuple$18[0], std = _tuple$18[1], suffix = _tuple$18[2];
					return [prefix, std, suffix];
				}
				if (layout.length >= (i + 6 >> 0) && layout.substring(i, (i + 6 >> 0)) === "-07:00") {
					_tuple$19 = [layout.substring(0, i), 29, layout.substring((i + 6 >> 0))], prefix = _tuple$19[0], std = _tuple$19[1], suffix = _tuple$19[2];
					return [prefix, std, suffix];
				}
				if (layout.length >= (i + 3 >> 0) && layout.substring(i, (i + 3 >> 0)) === "-07") {
					_tuple$20 = [layout.substring(0, i), 28, layout.substring((i + 3 >> 0))], prefix = _tuple$20[0], std = _tuple$20[1], suffix = _tuple$20[2];
					return [prefix, std, suffix];
				}
			} else if (_ref === 90) {
				if (layout.length >= (i + 7 >> 0) && layout.substring(i, (i + 7 >> 0)) === "Z070000") {
					_tuple$21 = [layout.substring(0, i), 23, layout.substring((i + 7 >> 0))], prefix = _tuple$21[0], std = _tuple$21[1], suffix = _tuple$21[2];
					return [prefix, std, suffix];
				}
				if (layout.length >= (i + 9 >> 0) && layout.substring(i, (i + 9 >> 0)) === "Z07:00:00") {
					_tuple$22 = [layout.substring(0, i), 25, layout.substring((i + 9 >> 0))], prefix = _tuple$22[0], std = _tuple$22[1], suffix = _tuple$22[2];
					return [prefix, std, suffix];
				}
				if (layout.length >= (i + 5 >> 0) && layout.substring(i, (i + 5 >> 0)) === "Z0700") {
					_tuple$23 = [layout.substring(0, i), 22, layout.substring((i + 5 >> 0))], prefix = _tuple$23[0], std = _tuple$23[1], suffix = _tuple$23[2];
					return [prefix, std, suffix];
				}
				if (layout.length >= (i + 6 >> 0) && layout.substring(i, (i + 6 >> 0)) === "Z07:00") {
					_tuple$24 = [layout.substring(0, i), 24, layout.substring((i + 6 >> 0))], prefix = _tuple$24[0], std = _tuple$24[1], suffix = _tuple$24[2];
					return [prefix, std, suffix];
				}
			} else if (_ref === 46) {
				if ((i + 1 >> 0) < layout.length && ((layout.charCodeAt((i + 1 >> 0)) === 48) || (layout.charCodeAt((i + 1 >> 0)) === 57))) {
					ch = layout.charCodeAt((i + 1 >> 0));
					j = i + 1 >> 0;
					while (j < layout.length && (layout.charCodeAt(j) === ch)) {
						j = j + 1 >> 0;
					}
					if (!isDigit(layout, j)) {
						std$1 = 31;
						if (layout.charCodeAt((i + 1 >> 0)) === 57) {
							std$1 = 32;
						}
						std$1 = std$1 | ((((j - ((i + 1 >> 0)) >> 0)) << 16 >> 0));
						_tuple$25 = [layout.substring(0, i), std$1, layout.substring(j)], prefix = _tuple$25[0], std = _tuple$25[1], suffix = _tuple$25[2];
						return [prefix, std, suffix];
					}
				}
			}
			i = i + 1 >> 0;
		}
		_tuple$26 = [layout, 0, ""], prefix = _tuple$26[0], std = _tuple$26[1], suffix = _tuple$26[2];
		return [prefix, std, suffix];
	};
	var match = function(s1, s2) {
		var i, c1, c2;
		i = 0;
		while (i < s1.length) {
			c1 = s1.charCodeAt(i);
			c2 = s2.charCodeAt(i);
			if (!((c1 === c2))) {
				c1 = (c1 | 32) >>> 0;
				c2 = (c2 | 32) >>> 0;
				if (!((c1 === c2)) || c1 < 97 || c1 > 122) {
					return false;
				}
			}
			i = i + 1 >> 0;
		}
		return true;
	};
	var lookup = function(tab, val) {
		var _ref, _i, _slice, _index, v, i;
		_ref = tab;
		_i = 0;
		while (_i < _ref.length) {
			v = (_slice = _ref, _index = _i, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range"));
			i = _i;
			if (val.length >= v.length && match(val.substring(0, v.length), v)) {
				return [i, val.substring(v.length), null];
			}
			_i++;
		}
		return [-1, val, errBad];
	};
	var appendUint = function(b, x, pad) {
		var _q, _r, buf, n, _r$1, _q$1;
		if (x < 10) {
			if (!((pad === 0))) {
				b = go$append(b, pad);
			}
			return go$append(b, ((48 + x >>> 0) << 24 >>> 24));
		}
		if (x < 100) {
			b = go$append(b, ((48 + (_q = x / 10, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >>> 0 : go$throwRuntimeError("integer divide by zero")) >>> 0) << 24 >>> 24));
			b = go$append(b, ((48 + (_r = x % 10, _r === _r ? _r : go$throwRuntimeError("integer divide by zero")) >>> 0) << 24 >>> 24));
			return b;
		}
		buf = go$makeNativeArray("Uint8", 32, function() { return 0; });
		n = 32;
		if (x === 0) {
			return go$append(b, 48);
		}
		while (x >= 10) {
			n = n - 1 >> 0;
			buf[n] = (((_r$1 = x % 10, _r$1 === _r$1 ? _r$1 : go$throwRuntimeError("integer divide by zero")) + 48 >>> 0) << 24 >>> 24);
			x = (_q$1 = x / 10, (_q$1 === _q$1 && _q$1 !== 1/0 && _q$1 !== -1/0) ? _q$1 >>> 0 : go$throwRuntimeError("integer divide by zero"));
		}
		n = n - 1 >> 0;
		buf[n] = ((x + 48 >>> 0) << 24 >>> 24);
		return go$appendSlice(b, go$subslice(new (go$sliceType(Go$Uint8))(buf), n));
	};
	var atoi = function(s) {
		var x, err, neg, _tuple, q, rem, _tuple$1, _tuple$2;
		x = 0;
		err = null;
		neg = false;
		if (!(s === "") && ((s.charCodeAt(0) === 45) || (s.charCodeAt(0) === 43))) {
			neg = s.charCodeAt(0) === 45;
			s = s.substring(1);
		}
		_tuple = leadingInt(s), q = _tuple[0], rem = _tuple[1], err = _tuple[2];
		x = ((q.low + ((q.high >> 31) * 4294967296)) >> 0);
		if (!(go$interfaceIsEqual(err, null)) || !(rem === "")) {
			_tuple$1 = [0, atoiError], x = _tuple$1[0], err = _tuple$1[1];
			return [x, err];
		}
		if (neg) {
			x = -x;
		}
		_tuple$2 = [x, null], x = _tuple$2[0], err = _tuple$2[1];
		return [x, err];
	};
	var formatNano = function(b, nanosec, n, trim) {
		var u, buf, start, _r, _q;
		u = nanosec;
		buf = go$makeNativeArray("Uint8", 9, function() { return 0; });
		start = 9;
		while (start > 0) {
			start = start - 1 >> 0;
			buf[start] = (((_r = u % 10, _r === _r ? _r : go$throwRuntimeError("integer divide by zero")) + 48 >>> 0) << 24 >>> 24);
			u = (_q = u / 10, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >>> 0 : go$throwRuntimeError("integer divide by zero"));
		}
		if (n > 9) {
			n = 9;
		}
		if (trim) {
			while (n > 0 && (buf[(n - 1 >> 0)] === 48)) {
				n = n - 1 >> 0;
			}
			if (n === 0) {
				return b;
			}
		}
		b = go$append(b, 46);
		return go$appendSlice(b, go$subslice(new (go$sliceType(Go$Uint8))(buf), 0, n));
	};
	Time.Ptr.prototype.String = function() {
		var _struct, t;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		return t.Format("2006-01-02 15:04:05.999999999 -0700 MST");
	};
	Time.prototype.String = function() { return this.go$val.String(); };
	Time.Ptr.prototype.Format = function(layout) {
		var _struct, t, _tuple, name, offset, abs, year, month, day, hour, min, sec, b, buf, max, _tuple$1, prefix, std, suffix, _tuple$2, _tuple$3, _ref, y, _r, y$1, m, s, _r$1, hr, _r$2, hr$1, _q, zone$1, absoffset, _q$1, _r$3, _r$4, _q$2, zone$2, _q$3, _r$5;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		_tuple = t.locabs(), name = _tuple[0], offset = _tuple[1], abs = _tuple[2], year = -1, month = 0, day = 0, hour = -1, min = 0, sec = 0, b = (go$sliceType(Go$Uint8)).nil, buf = go$makeNativeArray("Uint8", 64, function() { return 0; });
		max = layout.length + 10 >> 0;
		if (max <= 64) {
			b = go$subslice(new (go$sliceType(Go$Uint8))(buf), 0, 0);
		} else {
			b = (go$sliceType(Go$Uint8)).make(0, max, function() { return 0; });
		}
		while (!(layout === "")) {
			_tuple$1 = nextStdChunk(layout), prefix = _tuple$1[0], std = _tuple$1[1], suffix = _tuple$1[2];
			if (!(prefix === "")) {
				b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes(prefix)));
			}
			if (std === 0) {
				break;
			}
			layout = suffix;
			if (year < 0 && !(((std & 256) === 0))) {
				_tuple$2 = absDate(abs, true), year = _tuple$2[0], month = _tuple$2[1], day = _tuple$2[2];
			}
			if (hour < 0 && !(((std & 512) === 0))) {
				_tuple$3 = absClock(abs), hour = _tuple$3[0], min = _tuple$3[1], sec = _tuple$3[2];
			}
			_ref = std & 65535;
			switch (0) { default: if (_ref === 274) {
				y = year;
				if (y < 0) {
					y = -y;
				}
				b = appendUint(b, ((_r = y % 100, _r === _r ? _r : go$throwRuntimeError("integer divide by zero")) >>> 0), 48);
			} else if (_ref === 273) {
				y$1 = year;
				if (year <= -1000) {
					b = go$append(b, 45);
					y$1 = -y$1;
				} else if (year <= -100) {
					b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes("-0")));
					y$1 = -y$1;
				} else if (year <= -10) {
					b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes("-00")));
					y$1 = -y$1;
				} else if (year < 0) {
					b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes("-000")));
					y$1 = -y$1;
				} else if (year < 10) {
					b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes("000")));
				} else if (year < 100) {
					b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes("00")));
				} else if (year < 1000) {
					b = go$append(b, 48);
				}
				b = appendUint(b, (y$1 >>> 0), 0);
			} else if (_ref === 258) {
				b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes((new Month(month)).String().substring(0, 3))));
			} else if (_ref === 257) {
				m = (new Month(month)).String();
				b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes(m)));
			} else if (_ref === 259) {
				b = appendUint(b, (month >>> 0), 0);
			} else if (_ref === 260) {
				b = appendUint(b, (month >>> 0), 48);
			} else if (_ref === 262) {
				b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes((new Weekday(absWeekday(abs))).String().substring(0, 3))));
			} else if (_ref === 261) {
				s = (new Weekday(absWeekday(abs))).String();
				b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes(s)));
			} else if (_ref === 263) {
				b = appendUint(b, (day >>> 0), 0);
			} else if (_ref === 264) {
				b = appendUint(b, (day >>> 0), 32);
			} else if (_ref === 265) {
				b = appendUint(b, (day >>> 0), 48);
			} else if (_ref === 522) {
				b = appendUint(b, (hour >>> 0), 48);
			} else if (_ref === 523) {
				hr = (_r$1 = hour % 12, _r$1 === _r$1 ? _r$1 : go$throwRuntimeError("integer divide by zero"));
				if (hr === 0) {
					hr = 12;
				}
				b = appendUint(b, (hr >>> 0), 0);
			} else if (_ref === 524) {
				hr$1 = (_r$2 = hour % 12, _r$2 === _r$2 ? _r$2 : go$throwRuntimeError("integer divide by zero"));
				if (hr$1 === 0) {
					hr$1 = 12;
				}
				b = appendUint(b, (hr$1 >>> 0), 48);
			} else if (_ref === 525) {
				b = appendUint(b, (min >>> 0), 0);
			} else if (_ref === 526) {
				b = appendUint(b, (min >>> 0), 48);
			} else if (_ref === 527) {
				b = appendUint(b, (sec >>> 0), 0);
			} else if (_ref === 528) {
				b = appendUint(b, (sec >>> 0), 48);
			} else if (_ref === 531) {
				if (hour >= 12) {
					b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes("PM")));
				} else {
					b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes("AM")));
				}
			} else if (_ref === 532) {
				if (hour >= 12) {
					b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes("pm")));
				} else {
					b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes("am")));
				}
			} else if (_ref === 22 || _ref === 24 || _ref === 23 || _ref === 25 || _ref === 26 || _ref === 29 || _ref === 27 || _ref === 30) {
				if ((offset === 0) && ((std === 22) || (std === 24) || (std === 23) || (std === 25))) {
					b = go$append(b, 90);
					break;
				}
				zone$1 = (_q = offset / 60, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
				absoffset = offset;
				if (zone$1 < 0) {
					b = go$append(b, 45);
					zone$1 = -zone$1;
					absoffset = -absoffset;
				} else {
					b = go$append(b, 43);
				}
				b = appendUint(b, ((_q$1 = zone$1 / 60, (_q$1 === _q$1 && _q$1 !== 1/0 && _q$1 !== -1/0) ? _q$1 >> 0 : go$throwRuntimeError("integer divide by zero")) >>> 0), 48);
				if ((std === 24) || (std === 29)) {
					b = go$append(b, 58);
				}
				b = appendUint(b, ((_r$3 = zone$1 % 60, _r$3 === _r$3 ? _r$3 : go$throwRuntimeError("integer divide by zero")) >>> 0), 48);
				if ((std === 23) || (std === 27) || (std === 30) || (std === 25)) {
					if ((std === 30) || (std === 25)) {
						b = go$append(b, 58);
					}
					b = appendUint(b, ((_r$4 = absoffset % 60, _r$4 === _r$4 ? _r$4 : go$throwRuntimeError("integer divide by zero")) >>> 0), 48);
				}
			} else if (_ref === 21) {
				if (!(name === "")) {
					b = go$appendSlice(b, new (go$sliceType(Go$Uint8))(go$stringToBytes(name)));
					break;
				}
				zone$2 = (_q$2 = offset / 60, (_q$2 === _q$2 && _q$2 !== 1/0 && _q$2 !== -1/0) ? _q$2 >> 0 : go$throwRuntimeError("integer divide by zero"));
				if (zone$2 < 0) {
					b = go$append(b, 45);
					zone$2 = -zone$2;
				} else {
					b = go$append(b, 43);
				}
				b = appendUint(b, ((_q$3 = zone$2 / 60, (_q$3 === _q$3 && _q$3 !== 1/0 && _q$3 !== -1/0) ? _q$3 >> 0 : go$throwRuntimeError("integer divide by zero")) >>> 0), 48);
				b = appendUint(b, ((_r$5 = zone$2 % 60, _r$5 === _r$5 ? _r$5 : go$throwRuntimeError("integer divide by zero")) >>> 0), 48);
			} else if (_ref === 31 || _ref === 32) {
				b = formatNano(b, (t.Nanosecond() >>> 0), std >> 16 >> 0, (std & 65535) === 32);
			} }
		}
		return go$bytesToString(b);
	};
	Time.prototype.Format = function(layout) { return this.go$val.Format(layout); };
	var quote = function(s) {
		return "\"" + s + "\"";
	};
	ParseError.Ptr.prototype.Error = function() {
		var e;
		e = this;
		if (e.Message === "") {
			return "parsing time " + quote(e.Value) + " as " + quote(e.Layout) + ": cannot parse " + quote(e.ValueElem) + " as " + quote(e.LayoutElem);
		}
		return "parsing time " + quote(e.Value) + e.Message;
	};
	ParseError.prototype.Error = function() { return this.go$val.Error(); };
	var isDigit = function(s, i) {
		var c;
		if (s.length <= i) {
			return false;
		}
		c = s.charCodeAt(i);
		return 48 <= c && c <= 57;
	};
	var getnum = function(s, fixed) {
		var x, x$1;
		if (!isDigit(s, 0)) {
			return [0, s, errBad];
		}
		if (!isDigit(s, 1)) {
			if (fixed) {
				return [0, s, errBad];
			}
			return [((s.charCodeAt(0) - 48 << 24 >>> 24) >> 0), s.substring(1), null];
		}
		return [(x = ((s.charCodeAt(0) - 48 << 24 >>> 24) >> 0), x$1 = 10, (((x >>> 16 << 16) * x$1 >> 0) + (x << 16 >>> 16) * x$1) >> 0) + ((s.charCodeAt(1) - 48 << 24 >>> 24) >> 0) >> 0, s.substring(2), null];
	};
	var cutspace = function(s) {
		while (s.length > 0 && (s.charCodeAt(0) === 32)) {
			s = s.substring(1);
		}
		return s;
	};
	var skip = function(value, prefix) {
		while (prefix.length > 0) {
			if (prefix.charCodeAt(0) === 32) {
				if (value.length > 0 && !((value.charCodeAt(0) === 32))) {
					return [value, errBad];
				}
				prefix = cutspace(prefix);
				value = cutspace(value);
				continue;
			}
			if ((value.length === 0) || !((value.charCodeAt(0) === prefix.charCodeAt(0)))) {
				return [value, errBad];
			}
			prefix = prefix.substring(1);
			value = value.substring(1);
		}
		return [value, null];
	};
	var Parse = go$pkg.Parse = function(layout, value) {
		return parse(layout, value, go$pkg.UTC, go$pkg.Local);
	};
	var ParseInLocation = go$pkg.ParseInLocation = function(layout, value, loc) {
		return parse(layout, value, loc, loc);
	};
	var parse = function(layout, value, defaultLocation, local) {
		var _tuple, alayout, avalue, rangeErrString, amSet, pmSet, year, month, day, hour, min, sec, nsec, z, zoneOffset, zoneName, err, _tuple$1, prefix, std, suffix, stdstr, _tuple$2, p, _ref, _tuple$3, _tuple$4, _tuple$5, _tuple$6, _tuple$7, _tuple$8, _tuple$9, _tuple$10, _tuple$11, _tuple$12, _tuple$13, _tuple$14, _tuple$15, _tuple$16, _tuple$17, n, _tuple$18, _tuple$19, _ref$1, _tuple$20, _ref$2, _tuple$21, sign, hour$1, min$1, seconds, _tuple$22, _tuple$23, _tuple$24, _tuple$25, _tuple$26, _tuple$27, hr, mm, ss, _tuple$28, _tuple$29, _tuple$30, x, x$1, x$2, _ref$3, _tuple$31, n$1, ok, _tuple$32, ndigit, _tuple$33, i, _tuple$34, _struct, _struct$1, t, x$3, x$4, _tuple$35, x$5, name, offset, _struct$2, _struct$3, _struct$4, t$1, _tuple$36, x$6, offset$1, ok$1, x$7, x$8, _struct$5, _tuple$37, x$9, _struct$6, _struct$7;
		_tuple = [layout, value], alayout = _tuple[0], avalue = _tuple[1];
		rangeErrString = "";
		amSet = false;
		pmSet = false;
		year = 0, month = 1, day = 1, hour = 0, min = 0, sec = 0, nsec = 0, z = (go$ptrType(Location)).nil, zoneOffset = -1, zoneName = "";
		while (true) {
			err = null;
			_tuple$1 = nextStdChunk(layout), prefix = _tuple$1[0], std = _tuple$1[1], suffix = _tuple$1[2];
			stdstr = layout.substring(prefix.length, (layout.length - suffix.length >> 0));
			_tuple$2 = skip(value, prefix), value = _tuple$2[0], err = _tuple$2[1];
			if (!(go$interfaceIsEqual(err, null))) {
				return [new Time.Ptr(new Go$Int64(0, 0), 0, (go$ptrType(Location)).nil), new ParseError.Ptr(alayout, avalue, prefix, value, "")];
			}
			if (std === 0) {
				if (!((value.length === 0))) {
					return [new Time.Ptr(new Go$Int64(0, 0), 0, (go$ptrType(Location)).nil), new ParseError.Ptr(alayout, avalue, "", value, ": extra text: " + value)];
				}
				break;
			}
			layout = suffix;
			p = "";
			_ref = std & 65535;
			switch (0) { default: if (_ref === 274) {
				if (value.length < 2) {
					err = errBad;
					break;
				}
				_tuple$3 = [value.substring(0, 2), value.substring(2)], p = _tuple$3[0], value = _tuple$3[1];
				_tuple$4 = atoi(p), year = _tuple$4[0], err = _tuple$4[1];
				if (year >= 69) {
					year = year + 1900 >> 0;
				} else {
					year = year + 2000 >> 0;
				}
			} else if (_ref === 273) {
				if (value.length < 4 || !isDigit(value, 0)) {
					err = errBad;
					break;
				}
				_tuple$5 = [value.substring(0, 4), value.substring(4)], p = _tuple$5[0], value = _tuple$5[1];
				_tuple$6 = atoi(p), year = _tuple$6[0], err = _tuple$6[1];
			} else if (_ref === 258) {
				_tuple$7 = lookup(shortMonthNames, value), month = _tuple$7[0], value = _tuple$7[1], err = _tuple$7[2];
			} else if (_ref === 257) {
				_tuple$8 = lookup(longMonthNames, value), month = _tuple$8[0], value = _tuple$8[1], err = _tuple$8[2];
			} else if (_ref === 259 || _ref === 260) {
				_tuple$9 = getnum(value, std === 260), month = _tuple$9[0], value = _tuple$9[1], err = _tuple$9[2];
				if (month <= 0 || 12 < month) {
					rangeErrString = "month";
				}
			} else if (_ref === 262) {
				_tuple$10 = lookup(shortDayNames, value), value = _tuple$10[1], err = _tuple$10[2];
			} else if (_ref === 261) {
				_tuple$11 = lookup(longDayNames, value), value = _tuple$11[1], err = _tuple$11[2];
			} else if (_ref === 263 || _ref === 264 || _ref === 265) {
				if ((std === 264) && value.length > 0 && (value.charCodeAt(0) === 32)) {
					value = value.substring(1);
				}
				_tuple$12 = getnum(value, std === 265), day = _tuple$12[0], value = _tuple$12[1], err = _tuple$12[2];
				if (day < 0 || 31 < day) {
					rangeErrString = "day";
				}
			} else if (_ref === 522) {
				_tuple$13 = getnum(value, false), hour = _tuple$13[0], value = _tuple$13[1], err = _tuple$13[2];
				if (hour < 0 || 24 <= hour) {
					rangeErrString = "hour";
				}
			} else if (_ref === 523 || _ref === 524) {
				_tuple$14 = getnum(value, std === 524), hour = _tuple$14[0], value = _tuple$14[1], err = _tuple$14[2];
				if (hour < 0 || 12 < hour) {
					rangeErrString = "hour";
				}
			} else if (_ref === 525 || _ref === 526) {
				_tuple$15 = getnum(value, std === 526), min = _tuple$15[0], value = _tuple$15[1], err = _tuple$15[2];
				if (min < 0 || 60 <= min) {
					rangeErrString = "minute";
				}
			} else if (_ref === 527 || _ref === 528) {
				_tuple$16 = getnum(value, std === 528), sec = _tuple$16[0], value = _tuple$16[1], err = _tuple$16[2];
				if (sec < 0 || 60 <= sec) {
					rangeErrString = "second";
				}
				if (value.length >= 2 && (value.charCodeAt(0) === 46) && isDigit(value, 1)) {
					_tuple$17 = nextStdChunk(layout), std = _tuple$17[1];
					std = std & 65535;
					if ((std === 31) || (std === 32)) {
						break;
					}
					n = 2;
					while (n < value.length && isDigit(value, n)) {
						n = n + 1 >> 0;
					}
					_tuple$18 = parseNanoseconds(value, n), nsec = _tuple$18[0], rangeErrString = _tuple$18[1], err = _tuple$18[2];
					value = value.substring(n);
				}
			} else if (_ref === 531) {
				if (value.length < 2) {
					err = errBad;
					break;
				}
				_tuple$19 = [value.substring(0, 2), value.substring(2)], p = _tuple$19[0], value = _tuple$19[1];
				_ref$1 = p;
				if (_ref$1 === "PM") {
					pmSet = true;
				} else if (_ref$1 === "AM") {
					amSet = true;
				} else {
					err = errBad;
				}
			} else if (_ref === 532) {
				if (value.length < 2) {
					err = errBad;
					break;
				}
				_tuple$20 = [value.substring(0, 2), value.substring(2)], p = _tuple$20[0], value = _tuple$20[1];
				_ref$2 = p;
				if (_ref$2 === "pm") {
					pmSet = true;
				} else if (_ref$2 === "am") {
					amSet = true;
				} else {
					err = errBad;
				}
			} else if (_ref === 22 || _ref === 24 || _ref === 23 || _ref === 25 || _ref === 26 || _ref === 28 || _ref === 29 || _ref === 27 || _ref === 30) {
				if (((std === 22) || (std === 24)) && value.length >= 1 && (value.charCodeAt(0) === 90)) {
					value = value.substring(1);
					z = go$pkg.UTC;
					break;
				}
				_tuple$21 = ["", "", "", ""], sign = _tuple$21[0], hour$1 = _tuple$21[1], min$1 = _tuple$21[2], seconds = _tuple$21[3];
				if ((std === 24) || (std === 29)) {
					if (value.length < 6) {
						err = errBad;
						break;
					}
					if (!((value.charCodeAt(3) === 58))) {
						err = errBad;
						break;
					}
					_tuple$22 = [value.substring(0, 1), value.substring(1, 3), value.substring(4, 6), "00", value.substring(6)], sign = _tuple$22[0], hour$1 = _tuple$22[1], min$1 = _tuple$22[2], seconds = _tuple$22[3], value = _tuple$22[4];
				} else if (std === 28) {
					if (value.length < 3) {
						err = errBad;
						break;
					}
					_tuple$23 = [value.substring(0, 1), value.substring(1, 3), "00", "00", value.substring(3)], sign = _tuple$23[0], hour$1 = _tuple$23[1], min$1 = _tuple$23[2], seconds = _tuple$23[3], value = _tuple$23[4];
				} else if ((std === 25) || (std === 30)) {
					if (value.length < 9) {
						err = errBad;
						break;
					}
					if (!((value.charCodeAt(3) === 58)) || !((value.charCodeAt(6) === 58))) {
						err = errBad;
						break;
					}
					_tuple$24 = [value.substring(0, 1), value.substring(1, 3), value.substring(4, 6), value.substring(7, 9), value.substring(9)], sign = _tuple$24[0], hour$1 = _tuple$24[1], min$1 = _tuple$24[2], seconds = _tuple$24[3], value = _tuple$24[4];
				} else if ((std === 23) || (std === 27)) {
					if (value.length < 7) {
						err = errBad;
						break;
					}
					_tuple$25 = [value.substring(0, 1), value.substring(1, 3), value.substring(3, 5), value.substring(5, 7), value.substring(7)], sign = _tuple$25[0], hour$1 = _tuple$25[1], min$1 = _tuple$25[2], seconds = _tuple$25[3], value = _tuple$25[4];
				} else {
					if (value.length < 5) {
						err = errBad;
						break;
					}
					_tuple$26 = [value.substring(0, 1), value.substring(1, 3), value.substring(3, 5), "00", value.substring(5)], sign = _tuple$26[0], hour$1 = _tuple$26[1], min$1 = _tuple$26[2], seconds = _tuple$26[3], value = _tuple$26[4];
				}
				_tuple$27 = [0, 0, 0], hr = _tuple$27[0], mm = _tuple$27[1], ss = _tuple$27[2];
				_tuple$28 = atoi(hour$1), hr = _tuple$28[0], err = _tuple$28[1];
				if (go$interfaceIsEqual(err, null)) {
					_tuple$29 = atoi(min$1), mm = _tuple$29[0], err = _tuple$29[1];
				}
				if (go$interfaceIsEqual(err, null)) {
					_tuple$30 = atoi(seconds), ss = _tuple$30[0], err = _tuple$30[1];
				}
				zoneOffset = (x = ((x$1 = 60, (((hr >>> 16 << 16) * x$1 >> 0) + (hr << 16 >>> 16) * x$1) >> 0) + mm >> 0), x$2 = 60, (((x >>> 16 << 16) * x$2 >> 0) + (x << 16 >>> 16) * x$2) >> 0) + ss >> 0;
				_ref$3 = sign.charCodeAt(0);
				if (_ref$3 === 43) {
				} else if (_ref$3 === 45) {
					zoneOffset = -zoneOffset;
				} else {
					err = errBad;
				}
			} else if (_ref === 21) {
				if (value.length >= 3 && value.substring(0, 3) === "UTC") {
					z = go$pkg.UTC;
					value = value.substring(3);
					break;
				}
				_tuple$31 = parseTimeZone(value), n$1 = _tuple$31[0], ok = _tuple$31[1];
				if (!ok) {
					err = errBad;
					break;
				}
				_tuple$32 = [value.substring(0, n$1), value.substring(n$1)], zoneName = _tuple$32[0], value = _tuple$32[1];
			} else if (_ref === 31) {
				ndigit = 1 + ((std >> 16 >> 0)) >> 0;
				if (value.length < ndigit) {
					err = errBad;
					break;
				}
				_tuple$33 = parseNanoseconds(value, ndigit), nsec = _tuple$33[0], rangeErrString = _tuple$33[1], err = _tuple$33[2];
				value = value.substring(ndigit);
			} else if (_ref === 32) {
				if (value.length < 2 || !((value.charCodeAt(0) === 46)) || value.charCodeAt(1) < 48 || 57 < value.charCodeAt(1)) {
					break;
				}
				i = 0;
				while (i < 9 && (i + 1 >> 0) < value.length && 48 <= value.charCodeAt((i + 1 >> 0)) && value.charCodeAt((i + 1 >> 0)) <= 57) {
					i = i + 1 >> 0;
				}
				_tuple$34 = parseNanoseconds(value, 1 + i >> 0), nsec = _tuple$34[0], rangeErrString = _tuple$34[1], err = _tuple$34[2];
				value = value.substring((1 + i >> 0));
			} }
			if (!(rangeErrString === "")) {
				return [new Time.Ptr(new Go$Int64(0, 0), 0, (go$ptrType(Location)).nil), new ParseError.Ptr(alayout, avalue, stdstr, value, ": " + rangeErrString + " out of range")];
			}
			if (!(go$interfaceIsEqual(err, null))) {
				return [new Time.Ptr(new Go$Int64(0, 0), 0, (go$ptrType(Location)).nil), new ParseError.Ptr(alayout, avalue, stdstr, value, "")];
			}
		}
		if (pmSet && hour < 12) {
			hour = hour + 12 >> 0;
		} else if (amSet && (hour === 12)) {
			hour = 0;
		}
		if (!(z === (go$ptrType(Location)).nil)) {
			return [(_struct = Date(year, (month >> 0), day, hour, min, sec, nsec, z), new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc)), null];
		}
		if (!((zoneOffset === -1))) {
			t = (_struct$1 = Date(year, (month >> 0), day, hour, min, sec, nsec, go$pkg.UTC), new Time.Ptr(_struct$1.sec, _struct$1.nsec, _struct$1.loc));
			t.sec = (x$3 = t.sec, x$4 = new Go$Int64(0, zoneOffset), new Go$Int64(x$3.high - x$4.high, x$3.low - x$4.low));
			_tuple$35 = local.lookup((x$5 = t.sec, new Go$Int64(x$5.high + -15, x$5.low + 2288912640))), name = _tuple$35[0], offset = _tuple$35[1];
			if ((offset === zoneOffset) && (zoneName === "" || name === zoneName)) {
				t.loc = local;
				return [(_struct$2 = t, new Time.Ptr(_struct$2.sec, _struct$2.nsec, _struct$2.loc)), null];
			}
			t.loc = FixedZone(zoneName, zoneOffset);
			return [(_struct$3 = t, new Time.Ptr(_struct$3.sec, _struct$3.nsec, _struct$3.loc)), null];
		}
		if (!(zoneName === "")) {
			t$1 = (_struct$4 = Date(year, (month >> 0), day, hour, min, sec, nsec, go$pkg.UTC), new Time.Ptr(_struct$4.sec, _struct$4.nsec, _struct$4.loc));
			_tuple$36 = local.lookupName(zoneName, (x$6 = t$1.sec, new Go$Int64(x$6.high + -15, x$6.low + 2288912640))), offset$1 = _tuple$36[0], ok$1 = _tuple$36[2];
			if (ok$1) {
				t$1.sec = (x$7 = t$1.sec, x$8 = new Go$Int64(0, offset$1), new Go$Int64(x$7.high - x$8.high, x$7.low - x$8.low));
				t$1.loc = local;
				return [(_struct$5 = t$1, new Time.Ptr(_struct$5.sec, _struct$5.nsec, _struct$5.loc)), null];
			}
			if (zoneName.length > 3 && zoneName.substring(0, 3) === "GMT") {
				_tuple$37 = atoi(zoneName.substring(3)), offset$1 = _tuple$37[0];
				offset$1 = (x$9 = 3600, (((offset$1 >>> 16 << 16) * x$9 >> 0) + (offset$1 << 16 >>> 16) * x$9) >> 0);
			}
			t$1.loc = FixedZone(zoneName, offset$1);
			return [(_struct$6 = t$1, new Time.Ptr(_struct$6.sec, _struct$6.nsec, _struct$6.loc)), null];
		}
		return [(_struct$7 = Date(year, (month >> 0), day, hour, min, sec, nsec, defaultLocation), new Time.Ptr(_struct$7.sec, _struct$7.nsec, _struct$7.loc)), null];
	};
	var parseTimeZone = function(value) {
		var length, ok, _tuple, _tuple$1, _tuple$2, nUpper, c, _ref, _tuple$3, _tuple$4, _tuple$5, _tuple$6, _tuple$7;
		length = 0;
		ok = false;
		if (value.length < 3) {
			_tuple = [0, false], length = _tuple[0], ok = _tuple[1];
			return [length, ok];
		}
		if (value.length >= 4 && value.substring(0, 4) === "ChST") {
			_tuple$1 = [4, true], length = _tuple$1[0], ok = _tuple$1[1];
			return [length, ok];
		}
		if (value.substring(0, 3) === "GMT") {
			length = parseGMT(value);
			_tuple$2 = [length, true], length = _tuple$2[0], ok = _tuple$2[1];
			return [length, ok];
		}
		nUpper = 0;
		nUpper = 0;
		while (nUpper < 6) {
			if (nUpper >= value.length) {
				break;
			}
			if (c = value.charCodeAt(nUpper), c < 65 || 90 < c) {
				break;
			}
			nUpper = nUpper + 1 >> 0;
		}
		_ref = nUpper;
		if (_ref === 0 || _ref === 1 || _ref === 2 || _ref === 6) {
			_tuple$3 = [0, false], length = _tuple$3[0], ok = _tuple$3[1];
			return [length, ok];
		} else if (_ref === 5) {
			if (value.charCodeAt(4) === 84) {
				_tuple$4 = [5, true], length = _tuple$4[0], ok = _tuple$4[1];
				return [length, ok];
			}
		} else if (_ref === 4) {
			if (value.charCodeAt(3) === 84) {
				_tuple$5 = [4, true], length = _tuple$5[0], ok = _tuple$5[1];
				return [length, ok];
			}
		} else if (_ref === 3) {
			_tuple$6 = [3, true], length = _tuple$6[0], ok = _tuple$6[1];
			return [length, ok];
		}
		_tuple$7 = [0, false], length = _tuple$7[0], ok = _tuple$7[1];
		return [length, ok];
	};
	var parseGMT = function(value) {
		var sign, _tuple, x, rem, err;
		value = value.substring(3);
		if (value.length === 0) {
			return 3;
		}
		sign = value.charCodeAt(0);
		if (!((sign === 45)) && !((sign === 43))) {
			return 3;
		}
		_tuple = leadingInt(value.substring(1)), x = _tuple[0], rem = _tuple[1], err = _tuple[2];
		if (!(go$interfaceIsEqual(err, null))) {
			return 3;
		}
		if (sign === 45) {
			x = new Go$Int64(-x.high, -x.low);
		}
		if ((x.high === 0 && x.low === 0) || (x.high < -1 || (x.high === -1 && x.low < 4294967282)) || (0 < x.high || (0 === x.high && 12 < x.low))) {
			return 3;
		}
		return (3 + value.length >> 0) - rem.length >> 0;
	};
	var parseNanoseconds = function(value, nbytes) {
		var ns, rangeErrString, err, _tuple, scaleDigits, i, x;
		ns = 0;
		rangeErrString = "";
		err = null;
		if (!((value.charCodeAt(0) === 46))) {
			err = errBad;
			return [ns, rangeErrString, err];
		}
		if (_tuple = atoi(value.substring(1, nbytes)), ns = _tuple[0], err = _tuple[1], !(go$interfaceIsEqual(err, null))) {
			return [ns, rangeErrString, err];
		}
		if (ns < 0 || 1000000000 <= ns) {
			rangeErrString = "fractional second";
			return [ns, rangeErrString, err];
		}
		scaleDigits = 10 - nbytes >> 0;
		i = 0;
		while (i < scaleDigits) {
			ns = (x = 10, (((ns >>> 16 << 16) * x >> 0) + (ns << 16 >>> 16) * x) >> 0);
			i = i + 1 >> 0;
		}
		return [ns, rangeErrString, err];
	};
	var leadingInt = function(s) {
		var x, rem, err, i, c, _tuple, x$1, x$2, x$3, _tuple$1;
		x = new Go$Int64(0, 0);
		rem = "";
		err = null;
		i = 0;
		while (i < s.length) {
			c = s.charCodeAt(i);
			if (c < 48 || c > 57) {
				break;
			}
			if ((x.high > 214748364 || (x.high === 214748364 && x.low >= 3435973835))) {
				_tuple = [new Go$Int64(0, 0), "", errLeadingInt], x = _tuple[0], rem = _tuple[1], err = _tuple[2];
				return [x, rem, err];
			}
			x = (x$1 = (x$2 = go$mul64(x, new Go$Int64(0, 10)), x$3 = new Go$Int64(0, c), new Go$Int64(x$2.high + x$3.high, x$2.low + x$3.low)), new Go$Int64(x$1.high - 0, x$1.low - 48));
			i = i + 1 >> 0;
		}
		_tuple$1 = [x, s.substring(i), null], x = _tuple$1[0], rem = _tuple$1[1], err = _tuple$1[2];
		return [x, rem, err];
	};
	var ParseDuration = go$pkg.ParseDuration = function(s) {
		var orig, f, neg, c, g, x, err, pl, _tuple, pre, post, pl$1, _tuple$1, scale, n, i, c$1, u, _tuple$2, _entry, unit, ok;
		orig = s;
		f = 0;
		neg = false;
		if (!(s === "")) {
			c = s.charCodeAt(0);
			if ((c === 45) || (c === 43)) {
				neg = c === 45;
				s = s.substring(1);
			}
		}
		if (s === "0") {
			return [new Duration(0, 0), null];
		}
		if (s === "") {
			return [new Duration(0, 0), errors.New("time: invalid duration " + orig)];
		}
		while (!(s === "")) {
			g = 0;
			x = new Go$Int64(0, 0);
			err = null;
			if (!((s.charCodeAt(0) === 46) || (48 <= s.charCodeAt(0) && s.charCodeAt(0) <= 57))) {
				return [new Duration(0, 0), errors.New("time: invalid duration " + orig)];
			}
			pl = s.length;
			_tuple = leadingInt(s), x = _tuple[0], s = _tuple[1], err = _tuple[2];
			if (!(go$interfaceIsEqual(err, null))) {
				return [new Duration(0, 0), errors.New("time: invalid duration " + orig)];
			}
			g = go$flatten64(x);
			pre = !((pl === s.length));
			post = false;
			if (!(s === "") && (s.charCodeAt(0) === 46)) {
				s = s.substring(1);
				pl$1 = s.length;
				_tuple$1 = leadingInt(s), x = _tuple$1[0], s = _tuple$1[1], err = _tuple$1[2];
				if (!(go$interfaceIsEqual(err, null))) {
					return [new Duration(0, 0), errors.New("time: invalid duration " + orig)];
				}
				scale = 1;
				n = pl$1 - s.length >> 0;
				while (n > 0) {
					scale = scale * 10;
					n = n - 1 >> 0;
				}
				g = g + (go$flatten64(x) / scale);
				post = !((pl$1 === s.length));
			}
			if (!pre && !post) {
				return [new Duration(0, 0), errors.New("time: invalid duration " + orig)];
			}
			i = 0;
			while (i < s.length) {
				c$1 = s.charCodeAt(i);
				if ((c$1 === 46) || (48 <= c$1 && c$1 <= 57)) {
					break;
				}
				i = i + 1 >> 0;
			}
			if (i === 0) {
				return [new Duration(0, 0), errors.New("time: missing unit in duration " + orig)];
			}
			u = s.substring(0, i);
			s = s.substring(i);
			_tuple$2 = (_entry = unitMap[u], _entry !== undefined ? [_entry.v, true] : [0, false]), unit = _tuple$2[0], ok = _tuple$2[1];
			if (!ok) {
				return [new Duration(0, 0), errors.New("time: unknown unit " + u + " in duration " + orig)];
			}
			f = f + (g * unit);
		}
		if (neg) {
			f = -f;
		}
		return [new Duration(0, f), null];
	};
	var Sleep = go$pkg.Sleep = function() { go$notSupported("time.Sleep (use time.AfterFunc instead)") };
	var nano = function() {
		var _tuple, sec, nsec, x, x$1;
		_tuple = now(), sec = _tuple[0], nsec = _tuple[1];
		return (x = go$mul64(sec, new Go$Int64(0, 1000000000)), x$1 = new Go$Int64(0, nsec), new Go$Int64(x.high + x$1.high, x.low + x$1.low));
	};
	var when = function(d) {
		var x, x$1, t;
		if ((d.high < 0 || (d.high === 0 && d.low <= 0))) {
			return nano();
		}
		t = (x = nano(), x$1 = new Go$Int64(d.high, d.low), new Go$Int64(x.high + x$1.high, x.low + x$1.low));
		if ((t.high < 0 || (t.high === 0 && t.low < 0))) {
			t = new Go$Int64(2147483647, 4294967295);
		}
		return t;
	};
	var startTimer = function() {
		throw go$panic("Native function not implemented: startTimer");
	};
	var stopTimer = function() {
		throw go$panic("Native function not implemented: stopTimer");
	};
	Timer.Ptr.prototype.Stop = function() {
		var t;
		t = this;
		return stopTimer(t.r);
	};
	Timer.prototype.Stop = function() { return this.go$val.Stop(); };
	var NewTimer = go$pkg.NewTimer = function() { go$notSupported("time.NewTimer (use time.AfterFunc instead)") };
	Timer.Ptr.prototype.Reset = function(d) {
		var t, w, active;
		t = this;
		w = when(d);
		active = stopTimer(t.r);
		t.r.when = w;
		startTimer(t.r);
		return active;
	};
	Timer.prototype.Reset = function(d) { return this.go$val.Reset(d); };
	var sendTime = function(now$1, c) {
		go$notSupported("select")
	};
	var After = go$pkg.After = function() { go$notSupported("time.After (use time.AfterFunc instead)") };
	var AfterFunc = go$pkg.AfterFunc = function(d, f) {
			setTimeout(f, go$div64(d, new Duration(0, 1000000)).low);
			return null;
		};
	var goFunc = function(now$1, arg) {
		go$notSupported("go")
	};
	var interrupt = function() {
	};
	var readFile = function(name) {
		var _tuple, f, err, buf, ret, n, _tuple$1;
		var go$deferred = [];
		try {
			_tuple = syscall.Open(name, 0, 0), f = _tuple[0], err = _tuple[1];
			if (!(go$interfaceIsEqual(err, null))) {
				return [(go$sliceType(Go$Uint8)).nil, err];
			}
			go$deferred.push({ recv: syscall, method: "Close", args: [f] });
			buf = go$makeNativeArray("Uint8", 4096, function() { return 0; }), ret = (go$sliceType(Go$Uint8)).nil, n = 0;
			while (true) {
				_tuple$1 = syscall.Read(f, new (go$sliceType(Go$Uint8))(buf)), n = _tuple$1[0], err = _tuple$1[1];
				if (n > 0) {
					ret = go$appendSlice(ret, go$subslice(new (go$sliceType(Go$Uint8))(buf), 0, n));
				}
				if ((n === 0) || !(go$interfaceIsEqual(err, null))) {
					break;
				}
			}
			return [ret, err];
		} catch(go$err) {
			go$pushErr(go$err);
			return [(go$sliceType(Go$Uint8)).nil, null];
		} finally {
			go$callDeferred(go$deferred);
		}
	};
	var open = function(name) {
		var _tuple, fd, err;
		_tuple = syscall.Open(name, 0, 0), fd = _tuple[0], err = _tuple[1];
		if (!(go$interfaceIsEqual(err, null))) {
			return [0, err];
		}
		return [(fd >>> 0), null];
	};
	var closefd = function(fd) {
		syscall.Close((fd >>> 0));
	};
	var preadn = function(fd, buf, off) {
		var whence, err, _tuple, _tuple$1, m, err$1;
		whence = 0;
		if (off < 0) {
			whence = 2;
		}
		if (_tuple = syscall.Seek((fd >>> 0), new Go$Int64(0, off), whence), err = _tuple[1], !(go$interfaceIsEqual(err, null))) {
			return err;
		}
		while (buf.length > 0) {
			_tuple$1 = syscall.Read((fd >>> 0), buf), m = _tuple$1[0], err$1 = _tuple$1[1];
			if (m <= 0) {
				if (go$interfaceIsEqual(err$1, null)) {
					return errors.New("short read");
				}
				return err$1;
			}
			buf = go$subslice(buf, m);
		}
		return null;
	};
	var NewTicker = go$pkg.NewTicker = function(d) {
		var c, x, x$1, t;
		if ((d.high < 0 || (d.high === 0 && d.low <= 0))) {
			throw go$panic(errors.New("non-positive interval for NewTicker"));
		}
		c = new (go$chanType(Time, false, false))();
		t = new Ticker.Ptr(c, new runtimeTimer.Ptr(0, (x = nano(), x$1 = new Go$Int64(d.high, d.low), new Go$Int64(x.high + x$1.high, x.low + x$1.low)), new Go$Int64(d.high, d.low), sendTime, c));
		startTimer(t.r);
		return t;
	};
	Ticker.Ptr.prototype.Stop = function() {
		var t;
		t = this;
		stopTimer(t.r);
	};
	Ticker.prototype.Stop = function() { return this.go$val.Stop(); };
	var Tick = go$pkg.Tick = function() { go$notSupported("time.Tick (use time.AfterFunc instead)") };
	Time.Ptr.prototype.After = function(u) {
		var _struct, t, x, x$1, x$2, x$3;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		return (x = t.sec, x$1 = u.sec, (x.high > x$1.high || (x.high === x$1.high && x.low > x$1.low))) || (x$2 = t.sec, x$3 = u.sec, (x$2.high === x$3.high && x$2.low === x$3.low)) && t.nsec > u.nsec;
	};
	Time.prototype.After = function(u) { return this.go$val.After(u); };
	Time.Ptr.prototype.Before = function(u) {
		var _struct, t, x, x$1, x$2, x$3;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		return (x = t.sec, x$1 = u.sec, (x.high < x$1.high || (x.high === x$1.high && x.low < x$1.low))) || (x$2 = t.sec, x$3 = u.sec, (x$2.high === x$3.high && x$2.low === x$3.low)) && t.nsec < u.nsec;
	};
	Time.prototype.Before = function(u) { return this.go$val.Before(u); };
	Time.Ptr.prototype.Equal = function(u) {
		var _struct, t, x, x$1;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		return (x = t.sec, x$1 = u.sec, (x.high === x$1.high && x.low === x$1.low)) && (t.nsec === u.nsec);
	};
	Time.prototype.Equal = function(u) { return this.go$val.Equal(u); };
	Month.prototype.String = function() {
		var m;
		m = this.go$val;
		return months[(m - 1 >> 0)];
	};
	go$ptrType(Month).prototype.String = function() { return new Month(this.go$get()).String(); };
	Weekday.prototype.String = function() {
		var d;
		d = this.go$val;
		return days[d];
	};
	go$ptrType(Weekday).prototype.String = function() { return new Weekday(this.go$get()).String(); };
	Time.Ptr.prototype.IsZero = function() {
		var _struct, t, x;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		return (x = t.sec, (x.high === 0 && x.low === 0)) && (t.nsec === 0);
	};
	Time.prototype.IsZero = function() { return this.go$val.IsZero(); };
	Time.Ptr.prototype.abs = function() {
		var _struct, t, l, x, sec, x$1, x$2, x$3, _tuple, offset, x$4, x$5;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		l = t.loc;
		if (l === (go$ptrType(Location)).nil || l === localLoc) {
			l = l.get();
		}
		sec = (x = t.sec, new Go$Int64(x.high + -15, x.low + 2288912640));
		if (!(l === utcLoc)) {
			if (!(l.cacheZone === (go$ptrType(zone)).nil) && (x$1 = l.cacheStart, (x$1.high < sec.high || (x$1.high === sec.high && x$1.low <= sec.low))) && (x$2 = l.cacheEnd, (sec.high < x$2.high || (sec.high === x$2.high && sec.low < x$2.low)))) {
				sec = (x$3 = new Go$Int64(0, l.cacheZone.offset), new Go$Int64(sec.high + x$3.high, sec.low + x$3.low));
			} else {
				_tuple = l.lookup(sec), offset = _tuple[1];
				sec = (x$4 = new Go$Int64(0, offset), new Go$Int64(sec.high + x$4.high, sec.low + x$4.low));
			}
		}
		return (x$5 = new Go$Int64(sec.high + 2147483646, sec.low + 450480384), new Go$Uint64(x$5.high, x$5.low));
	};
	Time.prototype.abs = function() { return this.go$val.abs(); };
	Time.Ptr.prototype.locabs = function() {
		var name, offset, abs, _struct, t, l, x, sec, x$1, x$2, _tuple, x$3, x$4;
		name = "";
		offset = 0;
		abs = new Go$Uint64(0, 0);
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		l = t.loc;
		if (l === (go$ptrType(Location)).nil || l === localLoc) {
			l = l.get();
		}
		sec = (x = t.sec, new Go$Int64(x.high + -15, x.low + 2288912640));
		if (!(l === utcLoc)) {
			if (!(l.cacheZone === (go$ptrType(zone)).nil) && (x$1 = l.cacheStart, (x$1.high < sec.high || (x$1.high === sec.high && x$1.low <= sec.low))) && (x$2 = l.cacheEnd, (sec.high < x$2.high || (sec.high === x$2.high && sec.low < x$2.low)))) {
				name = l.cacheZone.name;
				offset = l.cacheZone.offset;
			} else {
				_tuple = l.lookup(sec), name = _tuple[0], offset = _tuple[1];
			}
			sec = (x$3 = new Go$Int64(0, offset), new Go$Int64(sec.high + x$3.high, sec.low + x$3.low));
		} else {
			name = "UTC";
		}
		abs = (x$4 = new Go$Int64(sec.high + 2147483646, sec.low + 450480384), new Go$Uint64(x$4.high, x$4.low));
		return [name, offset, abs];
	};
	Time.prototype.locabs = function() { return this.go$val.locabs(); };
	Time.Ptr.prototype.Date = function() {
		var year, month, day, _struct, t, _tuple;
		year = 0;
		month = 0;
		day = 0;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		_tuple = t.date(true), year = _tuple[0], month = _tuple[1], day = _tuple[2];
		return [year, month, day];
	};
	Time.prototype.Date = function() { return this.go$val.Date(); };
	Time.Ptr.prototype.Year = function() {
		var _struct, t, _tuple, year;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		_tuple = t.date(false), year = _tuple[0];
		return year;
	};
	Time.prototype.Year = function() { return this.go$val.Year(); };
	Time.Ptr.prototype.Month = function() {
		var _struct, t, _tuple, month;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		_tuple = t.date(true), month = _tuple[1];
		return month;
	};
	Time.prototype.Month = function() { return this.go$val.Month(); };
	Time.Ptr.prototype.Day = function() {
		var _struct, t, _tuple, day;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		_tuple = t.date(true), day = _tuple[2];
		return day;
	};
	Time.prototype.Day = function() { return this.go$val.Day(); };
	Time.Ptr.prototype.Weekday = function() {
		var _struct, t;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		return absWeekday(t.abs());
	};
	Time.prototype.Weekday = function() { return this.go$val.Weekday(); };
	var absWeekday = function(abs) {
		var sec, _q;
		sec = go$div64((new Go$Uint64(abs.high + 0, abs.low + 86400)), new Go$Uint64(0, 604800), true);
		return ((_q = (sec.low >> 0) / 86400, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero")) >> 0);
	};
	Time.Ptr.prototype.ISOWeek = function() {
		var year, week, _struct, t, _tuple, month, day, yday, _r, wday, _q, _r$1, jan1wday, dec31wday, _r$2;
		year = 0;
		week = 0;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		_tuple = t.date(true), year = _tuple[0], month = _tuple[1], day = _tuple[2], yday = _tuple[3];
		wday = (_r = ((t.Weekday() + 6 >> 0) >> 0) % 7, _r === _r ? _r : go$throwRuntimeError("integer divide by zero"));
		week = (_q = (((yday - wday >> 0) + 7 >> 0)) / 7, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
		jan1wday = (_r$1 = (((wday - yday >> 0) + 371 >> 0)) % 7, _r$1 === _r$1 ? _r$1 : go$throwRuntimeError("integer divide by zero"));
		if (1 <= jan1wday && jan1wday <= 3) {
			week = week + 1 >> 0;
		}
		if (week === 0) {
			year = year - 1 >> 0;
			week = 52;
			if ((jan1wday === 4) || ((jan1wday === 5) && isLeap(year))) {
				week = week + 1 >> 0;
			}
		}
		if ((month === 12) && day >= 29 && wday < 3) {
			if (dec31wday = (_r$2 = (((wday + 31 >> 0) - day >> 0)) % 7, _r$2 === _r$2 ? _r$2 : go$throwRuntimeError("integer divide by zero")), 0 <= dec31wday && dec31wday <= 2) {
				year = year + 1 >> 0;
				week = 1;
			}
		}
		return [year, week];
	};
	Time.prototype.ISOWeek = function() { return this.go$val.ISOWeek(); };
	Time.Ptr.prototype.Clock = function() {
		var hour, min, sec, _struct, t, _tuple;
		hour = 0;
		min = 0;
		sec = 0;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		_tuple = absClock(t.abs()), hour = _tuple[0], min = _tuple[1], sec = _tuple[2];
		return [hour, min, sec];
	};
	Time.prototype.Clock = function() { return this.go$val.Clock(); };
	var absClock = function(abs) {
		var hour, min, sec, _q, _q$1;
		hour = 0;
		min = 0;
		sec = 0;
		sec = (go$div64(abs, new Go$Uint64(0, 86400), true).low >> 0);
		hour = (_q = sec / 3600, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
		sec = sec - (((((hour >>> 16 << 16) * 3600 >> 0) + (hour << 16 >>> 16) * 3600) >> 0)) >> 0;
		min = (_q$1 = sec / 60, (_q$1 === _q$1 && _q$1 !== 1/0 && _q$1 !== -1/0) ? _q$1 >> 0 : go$throwRuntimeError("integer divide by zero"));
		sec = sec - (((((min >>> 16 << 16) * 60 >> 0) + (min << 16 >>> 16) * 60) >> 0)) >> 0;
		return [hour, min, sec];
	};
	Time.Ptr.prototype.Hour = function() {
		var _struct, t, _q;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		return (_q = (go$div64(t.abs(), new Go$Uint64(0, 86400), true).low >> 0) / 3600, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
	};
	Time.prototype.Hour = function() { return this.go$val.Hour(); };
	Time.Ptr.prototype.Minute = function() {
		var _struct, t, _q;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		return (_q = (go$div64(t.abs(), new Go$Uint64(0, 3600), true).low >> 0) / 60, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
	};
	Time.prototype.Minute = function() { return this.go$val.Minute(); };
	Time.Ptr.prototype.Second = function() {
		var _struct, t;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		return (go$div64(t.abs(), new Go$Uint64(0, 60), true).low >> 0);
	};
	Time.prototype.Second = function() { return this.go$val.Second(); };
	Time.Ptr.prototype.Nanosecond = function() {
		var _struct, t;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		return (t.nsec >> 0);
	};
	Time.prototype.Nanosecond = function() { return this.go$val.Nanosecond(); };
	Time.Ptr.prototype.YearDay = function() {
		var _struct, t, _tuple, yday;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		_tuple = t.date(false), yday = _tuple[3];
		return yday + 1 >> 0;
	};
	Time.prototype.YearDay = function() { return this.go$val.YearDay(); };
	Duration.prototype.String = function() {
		var d, buf, w, u, neg, prec, unit, _tuple, _tuple$1;
		d = this;
		buf = go$makeNativeArray("Uint8", 32, function() { return 0; });
		w = 32;
		u = new Go$Uint64(d.high, d.low);
		neg = (d.high < 0 || (d.high === 0 && d.low < 0));
		if (neg) {
			u = new Go$Uint64(-u.high, -u.low);
		}
		if ((u.high < 0 || (u.high === 0 && u.low < 1000000000))) {
			prec = 0, unit = 0;
			if ((u.high === 0 && u.low === 0)) {
				return "0";
			} else if ((u.high < 0 || (u.high === 0 && u.low < 1000))) {
				prec = 0;
				unit = 110;
			} else if ((u.high < 0 || (u.high === 0 && u.low < 1000000))) {
				prec = 3;
				unit = 117;
			} else {
				prec = 6;
				unit = 109;
			}
			w = w - 2 >> 0;
			buf[w] = unit;
			buf[w + 1 >> 0] = 115;
			_tuple = fmtFrac(go$subslice(new (go$sliceType(Go$Uint8))(buf), 0, w), u, prec), w = _tuple[0], u = _tuple[1];
			w = fmtInt(go$subslice(new (go$sliceType(Go$Uint8))(buf), 0, w), u);
		} else {
			w = w - 1 >> 0;
			buf[w] = 115;
			_tuple$1 = fmtFrac(go$subslice(new (go$sliceType(Go$Uint8))(buf), 0, w), u, 9), w = _tuple$1[0], u = _tuple$1[1];
			w = fmtInt(go$subslice(new (go$sliceType(Go$Uint8))(buf), 0, w), go$div64(u, new Go$Uint64(0, 60), true));
			u = go$div64(u, new Go$Uint64(0, 60), false);
			if ((u.high > 0 || (u.high === 0 && u.low > 0))) {
				w = w - 1 >> 0;
				buf[w] = 109;
				w = fmtInt(go$subslice(new (go$sliceType(Go$Uint8))(buf), 0, w), go$div64(u, new Go$Uint64(0, 60), true));
				u = go$div64(u, new Go$Uint64(0, 60), false);
				if ((u.high > 0 || (u.high === 0 && u.low > 0))) {
					w = w - 1 >> 0;
					buf[w] = 104;
					w = fmtInt(go$subslice(new (go$sliceType(Go$Uint8))(buf), 0, w), u);
				}
			}
		}
		if (neg) {
			w = w - 1 >> 0;
			buf[w] = 45;
		}
		return go$bytesToString(go$subslice(new (go$sliceType(Go$Uint8))(buf), w));
	};
	go$ptrType(Duration).prototype.String = function() { return this.go$get().String(); };
	var fmtFrac = function(buf, v, prec) {
		var nw, nv, w, print, i, digit, _slice, _index, _slice$1, _index$1, _tuple;
		nw = 0;
		nv = new Go$Uint64(0, 0);
		w = buf.length;
		print = false;
		i = 0;
		while (i < prec) {
			digit = go$div64(v, new Go$Uint64(0, 10), true);
			print = print || !((digit.high === 0 && digit.low === 0));
			if (print) {
				w = w - 1 >> 0;
				_slice = buf, _index = w, (_index >= 0 && _index < _slice.length) ? (_slice.array[_slice.offset + _index] = (digit.low << 24 >>> 24) + 48 << 24 >>> 24) : go$throwRuntimeError("index out of range");
			}
			v = go$div64(v, new Go$Uint64(0, 10), false);
			i = i + 1 >> 0;
		}
		if (print) {
			w = w - 1 >> 0;
			_slice$1 = buf, _index$1 = w, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = 46) : go$throwRuntimeError("index out of range");
		}
		_tuple = [w, v], nw = _tuple[0], nv = _tuple[1];
		return [nw, nv];
	};
	var fmtInt = function(buf, v) {
		var w, _slice, _index, _slice$1, _index$1;
		w = buf.length;
		if ((v.high === 0 && v.low === 0)) {
			w = w - 1 >> 0;
			_slice = buf, _index = w, (_index >= 0 && _index < _slice.length) ? (_slice.array[_slice.offset + _index] = 48) : go$throwRuntimeError("index out of range");
		} else {
			while ((v.high > 0 || (v.high === 0 && v.low > 0))) {
				w = w - 1 >> 0;
				_slice$1 = buf, _index$1 = w, (_index$1 >= 0 && _index$1 < _slice$1.length) ? (_slice$1.array[_slice$1.offset + _index$1] = (go$div64(v, new Go$Uint64(0, 10), true).low << 24 >>> 24) + 48 << 24 >>> 24) : go$throwRuntimeError("index out of range");
				v = go$div64(v, new Go$Uint64(0, 10), false);
			}
		}
		return w;
	};
	Duration.prototype.Nanoseconds = function() {
		var d;
		d = this;
		return new Go$Int64(d.high, d.low);
	};
	go$ptrType(Duration).prototype.Nanoseconds = function() { return this.go$get().Nanoseconds(); };
	Duration.prototype.Seconds = function() {
		var d, sec, nsec;
		d = this;
		sec = go$div64(d, new Duration(0, 1000000000), false);
		nsec = go$div64(d, new Duration(0, 1000000000), true);
		return go$flatten64(sec) + go$flatten64(nsec) * 1e-09;
	};
	go$ptrType(Duration).prototype.Seconds = function() { return this.go$get().Seconds(); };
	Duration.prototype.Minutes = function() {
		var d, min, nsec;
		d = this;
		min = go$div64(d, new Duration(13, 4165425152), false);
		nsec = go$div64(d, new Duration(13, 4165425152), true);
		return go$flatten64(min) + go$flatten64(nsec) * 1.6666666666666667e-11;
	};
	go$ptrType(Duration).prototype.Minutes = function() { return this.go$get().Minutes(); };
	Duration.prototype.Hours = function() {
		var d, hour, nsec;
		d = this;
		hour = go$div64(d, new Duration(838, 817405952), false);
		nsec = go$div64(d, new Duration(838, 817405952), true);
		return go$flatten64(hour) + go$flatten64(nsec) * 2.777777777777778e-13;
	};
	go$ptrType(Duration).prototype.Hours = function() { return this.go$get().Hours(); };
	Time.Ptr.prototype.Add = function(d) {
		var _struct, t, x, x$1, x$2, x$3, nsec, x$4, x$5, _struct$1;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		t.sec = (x = t.sec, x$1 = (x$2 = go$div64(d, new Duration(0, 1000000000), false), new Go$Int64(x$2.high, x$2.low)), new Go$Int64(x.high + x$1.high, x.low + x$1.low));
		nsec = (t.nsec >> 0) + ((x$3 = go$div64(d, new Duration(0, 1000000000), true), x$3.low + ((x$3.high >> 31) * 4294967296)) >> 0) >> 0;
		if (nsec >= 1000000000) {
			t.sec = (x$4 = t.sec, new Go$Int64(x$4.high + 0, x$4.low + 1));
			nsec = nsec - 1000000000 >> 0;
		} else if (nsec < 0) {
			t.sec = (x$5 = t.sec, new Go$Int64(x$5.high - 0, x$5.low - 1));
			nsec = nsec + 1000000000 >> 0;
		}
		t.nsec = (nsec >>> 0);
		return (_struct$1 = t, new Time.Ptr(_struct$1.sec, _struct$1.nsec, _struct$1.loc));
	};
	Time.prototype.Add = function(d) { return this.go$val.Add(d); };
	Time.Ptr.prototype.Sub = function(u) {
		var _struct, t, x, x$1, x$2, x$3, x$4, d, _struct$1, _struct$2;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		d = (x = go$mul64((x$1 = (x$2 = t.sec, x$3 = u.sec, new Go$Int64(x$2.high - x$3.high, x$2.low - x$3.low)), new Duration(x$1.high, x$1.low)), new Duration(0, 1000000000)), x$4 = new Duration(0, ((t.nsec >> 0) - (u.nsec >> 0) >> 0)), new Duration(x.high + x$4.high, x.low + x$4.low));
		if (u.Add(d).Equal((_struct$1 = t, new Time.Ptr(_struct$1.sec, _struct$1.nsec, _struct$1.loc)))) {
			return d;
		} else if (t.Before((_struct$2 = u, new Time.Ptr(_struct$2.sec, _struct$2.nsec, _struct$2.loc)))) {
			return new Duration(-2147483648, 0);
		} else {
			return new Duration(2147483647, 4294967295);
		}
	};
	Time.prototype.Sub = function(u) { return this.go$val.Sub(u); };
	var Since = go$pkg.Since = function(t) {
		var _struct;
		return Now().Sub((_struct = t, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc)));
	};
	Time.Ptr.prototype.AddDate = function(years, months$1, days$1) {
		var _struct, t, _tuple, year, month, day, _tuple$1, hour, min, sec, _struct$1;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		_tuple = t.Date(), year = _tuple[0], month = _tuple[1], day = _tuple[2];
		_tuple$1 = t.Clock(), hour = _tuple$1[0], min = _tuple$1[1], sec = _tuple$1[2];
		return (_struct$1 = Date(year + years >> 0, month + (months$1 >> 0) >> 0, day + days$1 >> 0, hour, min, sec, (t.nsec >> 0), t.loc), new Time.Ptr(_struct$1.sec, _struct$1.nsec, _struct$1.loc));
	};
	Time.prototype.AddDate = function(years, months$1, days$1) { return this.go$val.AddDate(years, months$1, days$1); };
	Time.Ptr.prototype.date = function(full) {
		var year, month, day, yday, _struct, t, _tuple;
		year = 0;
		month = 0;
		day = 0;
		yday = 0;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		_tuple = absDate(t.abs(), full), year = _tuple[0], month = _tuple[1], day = _tuple[2], yday = _tuple[3];
		return [year, month, day, yday];
	};
	Time.prototype.date = function(full) { return this.go$val.date(full); };
	var absDate = function(abs, full) {
		var year, month, day, yday, d, n, y, x, x$1, x$2, x$3, x$4, x$5, x$6, x$7, x$8, x$9, x$10, _q, end, begin;
		year = 0;
		month = 0;
		day = 0;
		yday = 0;
		d = go$div64(abs, new Go$Uint64(0, 86400), false);
		n = go$div64(d, new Go$Uint64(0, 146097), false);
		y = go$mul64(new Go$Uint64(0, 400), n);
		d = (x = go$mul64(new Go$Uint64(0, 146097), n), new Go$Uint64(d.high - x.high, d.low - x.low));
		n = go$div64(d, new Go$Uint64(0, 36524), false);
		n = (x$1 = go$shiftRightUint64(n, 2), new Go$Uint64(n.high - x$1.high, n.low - x$1.low));
		y = (x$2 = go$mul64(new Go$Uint64(0, 100), n), new Go$Uint64(y.high + x$2.high, y.low + x$2.low));
		d = (x$3 = go$mul64(new Go$Uint64(0, 36524), n), new Go$Uint64(d.high - x$3.high, d.low - x$3.low));
		n = go$div64(d, new Go$Uint64(0, 1461), false);
		y = (x$4 = go$mul64(new Go$Uint64(0, 4), n), new Go$Uint64(y.high + x$4.high, y.low + x$4.low));
		d = (x$5 = go$mul64(new Go$Uint64(0, 1461), n), new Go$Uint64(d.high - x$5.high, d.low - x$5.low));
		n = go$div64(d, new Go$Uint64(0, 365), false);
		n = (x$6 = go$shiftRightUint64(n, 2), new Go$Uint64(n.high - x$6.high, n.low - x$6.low));
		y = (x$7 = n, new Go$Uint64(y.high + x$7.high, y.low + x$7.low));
		d = (x$8 = go$mul64(new Go$Uint64(0, 365), n), new Go$Uint64(d.high - x$8.high, d.low - x$8.low));
		year = ((x$9 = (x$10 = new Go$Int64(y.high, y.low), new Go$Int64(x$10.high + -69, x$10.low + 4075721025)), x$9.low + ((x$9.high >> 31) * 4294967296)) >> 0);
		yday = (d.low >> 0);
		if (!full) {
			return [year, month, day, yday];
		}
		day = yday;
		if (isLeap(year)) {
			if (day > 59) {
				day = day - 1 >> 0;
			} else if (day === 59) {
				month = 2;
				day = 29;
				return [year, month, day, yday];
			}
		}
		month = ((_q = day / 31, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero")) >> 0);
		end = (daysBefore[(month + 1 >> 0)] >> 0);
		begin = 0;
		if (day >= end) {
			month = month + 1 >> 0;
			begin = end;
		} else {
			begin = (daysBefore[month] >> 0);
		}
		month = month + 1 >> 0;
		day = (day - begin >> 0) + 1 >> 0;
		return [year, month, day, yday];
	};
	var daysIn = function(m, year) {
		if ((m === 2) && isLeap(year)) {
			return 29;
		}
		return ((daysBefore[m] - daysBefore[(m - 1 >> 0)] >> 0) >> 0);
	};
	var now = go$now;
	var Now = go$pkg.Now = function() {
		var _tuple, sec, nsec;
		_tuple = now(), sec = _tuple[0], nsec = _tuple[1];
		return new Time.Ptr(new Go$Int64(sec.high + 14, sec.low + 2006054656), (nsec >>> 0), go$pkg.Local);
	};
	Time.Ptr.prototype.UTC = function() {
		var _struct, t, _struct$1;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		t.loc = go$pkg.UTC;
		return (_struct$1 = t, new Time.Ptr(_struct$1.sec, _struct$1.nsec, _struct$1.loc));
	};
	Time.prototype.UTC = function() { return this.go$val.UTC(); };
	Time.Ptr.prototype.Local = function() {
		var _struct, t, _struct$1;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		t.loc = go$pkg.Local;
		return (_struct$1 = t, new Time.Ptr(_struct$1.sec, _struct$1.nsec, _struct$1.loc));
	};
	Time.prototype.Local = function() { return this.go$val.Local(); };
	Time.Ptr.prototype.In = function(loc) {
		var _struct, t, _struct$1;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		if (loc === (go$ptrType(Location)).nil) {
			throw go$panic(new Go$String("time: missing Location in call to Time.In"));
		}
		t.loc = loc;
		return (_struct$1 = t, new Time.Ptr(_struct$1.sec, _struct$1.nsec, _struct$1.loc));
	};
	Time.prototype.In = function(loc) { return this.go$val.In(loc); };
	Time.Ptr.prototype.Location = function() {
		var _struct, t, l;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		l = t.loc;
		if (l === (go$ptrType(Location)).nil) {
			l = go$pkg.UTC;
		}
		return l;
	};
	Time.prototype.Location = function() { return this.go$val.Location(); };
	Time.Ptr.prototype.Zone = function() {
		var name, offset, _struct, t, _tuple, x;
		name = "";
		offset = 0;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		_tuple = t.loc.lookup((x = t.sec, new Go$Int64(x.high + -15, x.low + 2288912640))), name = _tuple[0], offset = _tuple[1];
		return [name, offset];
	};
	Time.prototype.Zone = function() { return this.go$val.Zone(); };
	Time.Ptr.prototype.Unix = function() {
		var _struct, t, x;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		return (x = t.sec, new Go$Int64(x.high + -15, x.low + 2288912640));
	};
	Time.prototype.Unix = function() { return this.go$val.Unix(); };
	Time.Ptr.prototype.UnixNano = function() {
		var _struct, t, x, x$1, x$2, x$3;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		return (x = go$mul64(((x$1 = t.sec, new Go$Int64(x$1.high + -15, x$1.low + 2288912640))), new Go$Int64(0, 1000000000)), x$2 = (x$3 = t.nsec, new Go$Int64(0, x$3.constructor === Number ? x$3 : 1)), new Go$Int64(x.high + x$2.high, x.low + x$2.low));
	};
	Time.prototype.UnixNano = function() { return this.go$val.UnixNano(); };
	Time.Ptr.prototype.MarshalBinary = function() {
		var _struct, t, offsetMin, _tuple, offset, _r, _q, enc;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		offsetMin = 0;
		if (t.Location() === utcLoc) {
			offsetMin = -1;
		} else {
			_tuple = t.Zone(), offset = _tuple[1];
			if (!(((_r = offset % 60, _r === _r ? _r : go$throwRuntimeError("integer divide by zero")) === 0))) {
				return [(go$sliceType(Go$Uint8)).nil, errors.New("Time.MarshalBinary: zone offset has fractional minute")];
			}
			offset = (_q = offset / 60, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero"));
			if (offset < -32768 || (offset === -1) || offset > 32767) {
				return [(go$sliceType(Go$Uint8)).nil, errors.New("Time.MarshalBinary: unexpected zone offset")];
			}
			offsetMin = (offset << 16 >> 16);
		}
		enc = new (go$sliceType(Go$Uint8))([1, (go$shiftRightInt64(t.sec, 56).low << 24 >>> 24), (go$shiftRightInt64(t.sec, 48).low << 24 >>> 24), (go$shiftRightInt64(t.sec, 40).low << 24 >>> 24), (go$shiftRightInt64(t.sec, 32).low << 24 >>> 24), (go$shiftRightInt64(t.sec, 24).low << 24 >>> 24), (go$shiftRightInt64(t.sec, 16).low << 24 >>> 24), (go$shiftRightInt64(t.sec, 8).low << 24 >>> 24), (t.sec.low << 24 >>> 24), ((t.nsec >>> 24 >>> 0) << 24 >>> 24), ((t.nsec >>> 16 >>> 0) << 24 >>> 24), ((t.nsec >>> 8 >>> 0) << 24 >>> 24), (t.nsec << 24 >>> 24), ((offsetMin >> 8 << 16 >> 16) << 24 >>> 24), (offsetMin << 24 >>> 24)]);
		return [enc, null];
	};
	Time.prototype.MarshalBinary = function() { return this.go$val.MarshalBinary(); };
	Time.Ptr.prototype.UnmarshalBinary = function(data$1) {
		var t, buf, _slice, _index, x, x$1, x$2, x$3, x$4, x$5, x$6, _slice$1, _index$1, x$7, _slice$2, _index$2, x$8, _slice$3, _index$3, x$9, _slice$4, _index$4, x$10, _slice$5, _index$5, x$11, _slice$6, _index$6, x$12, _slice$7, _index$7, x$13, _slice$8, _index$8, _slice$9, _index$9, _slice$10, _index$10, _slice$11, _index$11, _slice$12, _index$12, x$14, _slice$13, _index$13, _slice$14, _index$14, x$15, offset, localoff, _tuple, x$16;
		t = this;
		buf = data$1;
		if (buf.length === 0) {
			return errors.New("Time.UnmarshalBinary: no data");
		}
		if (!(((_slice = buf, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) === 1))) {
			return errors.New("Time.UnmarshalBinary: unsupported version");
		}
		if (!((buf.length === 15))) {
			return errors.New("Time.UnmarshalBinary: invalid length");
		}
		buf = go$subslice(buf, 1);
		t.sec = (x = (x$1 = (x$2 = (x$3 = (x$4 = (x$5 = (x$6 = new Go$Int64(0, (_slice$1 = buf, _index$1 = 7, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range"))), x$7 = go$shiftLeft64(new Go$Int64(0, (_slice$2 = buf, _index$2 = 6, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range"))), 8), new Go$Int64(x$6.high | x$7.high, (x$6.low | x$7.low) >>> 0)), x$8 = go$shiftLeft64(new Go$Int64(0, (_slice$3 = buf, _index$3 = 5, (_index$3 >= 0 && _index$3 < _slice$3.length) ? _slice$3.array[_slice$3.offset + _index$3] : go$throwRuntimeError("index out of range"))), 16), new Go$Int64(x$5.high | x$8.high, (x$5.low | x$8.low) >>> 0)), x$9 = go$shiftLeft64(new Go$Int64(0, (_slice$4 = buf, _index$4 = 4, (_index$4 >= 0 && _index$4 < _slice$4.length) ? _slice$4.array[_slice$4.offset + _index$4] : go$throwRuntimeError("index out of range"))), 24), new Go$Int64(x$4.high | x$9.high, (x$4.low | x$9.low) >>> 0)), x$10 = go$shiftLeft64(new Go$Int64(0, (_slice$5 = buf, _index$5 = 3, (_index$5 >= 0 && _index$5 < _slice$5.length) ? _slice$5.array[_slice$5.offset + _index$5] : go$throwRuntimeError("index out of range"))), 32), new Go$Int64(x$3.high | x$10.high, (x$3.low | x$10.low) >>> 0)), x$11 = go$shiftLeft64(new Go$Int64(0, (_slice$6 = buf, _index$6 = 2, (_index$6 >= 0 && _index$6 < _slice$6.length) ? _slice$6.array[_slice$6.offset + _index$6] : go$throwRuntimeError("index out of range"))), 40), new Go$Int64(x$2.high | x$11.high, (x$2.low | x$11.low) >>> 0)), x$12 = go$shiftLeft64(new Go$Int64(0, (_slice$7 = buf, _index$7 = 1, (_index$7 >= 0 && _index$7 < _slice$7.length) ? _slice$7.array[_slice$7.offset + _index$7] : go$throwRuntimeError("index out of range"))), 48), new Go$Int64(x$1.high | x$12.high, (x$1.low | x$12.low) >>> 0)), x$13 = go$shiftLeft64(new Go$Int64(0, (_slice$8 = buf, _index$8 = 0, (_index$8 >= 0 && _index$8 < _slice$8.length) ? _slice$8.array[_slice$8.offset + _index$8] : go$throwRuntimeError("index out of range"))), 56), new Go$Int64(x.high | x$13.high, (x.low | x$13.low) >>> 0));
		buf = go$subslice(buf, 8);
		t.nsec = ((((((_slice$9 = buf, _index$9 = 3, (_index$9 >= 0 && _index$9 < _slice$9.length) ? _slice$9.array[_slice$9.offset + _index$9] : go$throwRuntimeError("index out of range")) >> 0) | (((_slice$10 = buf, _index$10 = 2, (_index$10 >= 0 && _index$10 < _slice$10.length) ? _slice$10.array[_slice$10.offset + _index$10] : go$throwRuntimeError("index out of range")) >> 0) << 8 >> 0)) | (((_slice$11 = buf, _index$11 = 1, (_index$11 >= 0 && _index$11 < _slice$11.length) ? _slice$11.array[_slice$11.offset + _index$11] : go$throwRuntimeError("index out of range")) >> 0) << 16 >> 0)) | (((_slice$12 = buf, _index$12 = 0, (_index$12 >= 0 && _index$12 < _slice$12.length) ? _slice$12.array[_slice$12.offset + _index$12] : go$throwRuntimeError("index out of range")) >> 0) << 24 >> 0)) >>> 0);
		buf = go$subslice(buf, 4);
		offset = (x$14 = ((((_slice$13 = buf, _index$13 = 1, (_index$13 >= 0 && _index$13 < _slice$13.length) ? _slice$13.array[_slice$13.offset + _index$13] : go$throwRuntimeError("index out of range")) << 16 >> 16) | (((_slice$14 = buf, _index$14 = 0, (_index$14 >= 0 && _index$14 < _slice$14.length) ? _slice$14.array[_slice$14.offset + _index$14] : go$throwRuntimeError("index out of range")) << 16 >> 16) << 8 << 16 >> 16)) >> 0), x$15 = 60, (((x$14 >>> 16 << 16) * x$15 >> 0) + (x$14 << 16 >>> 16) * x$15) >> 0);
		if (offset === -60) {
			t.loc = utcLoc;
		} else if (_tuple = go$pkg.Local.lookup((x$16 = t.sec, new Go$Int64(x$16.high + -15, x$16.low + 2288912640))), localoff = _tuple[1], offset === localoff) {
			t.loc = go$pkg.Local;
		} else {
			t.loc = FixedZone("", offset);
		}
		return null;
	};
	Time.prototype.UnmarshalBinary = function(data$1) { return this.go$val.UnmarshalBinary(data$1); };
	Time.Ptr.prototype.GobEncode = function() {
		var _struct, t;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		return t.MarshalBinary();
	};
	Time.prototype.GobEncode = function() { return this.go$val.GobEncode(); };
	Time.Ptr.prototype.GobDecode = function(data$1) {
		var t;
		t = this;
		return t.UnmarshalBinary(data$1);
	};
	Time.prototype.GobDecode = function(data$1) { return this.go$val.GobDecode(data$1); };
	Time.Ptr.prototype.MarshalJSON = function() {
		var _struct, t, y;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		if (y = t.Year(), y < 0 || y >= 10000) {
			return [(go$sliceType(Go$Uint8)).nil, errors.New("Time.MarshalJSON: year outside of range [0,9999]")];
		}
		return [new (go$sliceType(Go$Uint8))(go$stringToBytes(t.Format("\"2006-01-02T15:04:05.999999999Z07:00\""))), null];
	};
	Time.prototype.MarshalJSON = function() { return this.go$val.MarshalJSON(); };
	Time.Ptr.prototype.UnmarshalJSON = function(data$1) {
		var err, t, _tuple, _struct, l, r;
		err = null;
		t = this;
		_tuple = Parse("\"2006-01-02T15:04:05Z07:00\"", go$bytesToString(data$1)), l = t, r = (_struct = _tuple[0], new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc)), l.sec = r.sec, l.nsec = r.nsec, l.loc = r.loc, err = _tuple[1];
		return err;
	};
	Time.prototype.UnmarshalJSON = function(data$1) { return this.go$val.UnmarshalJSON(data$1); };
	Time.Ptr.prototype.MarshalText = function() {
		var _struct, t, y;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		if (y = t.Year(), y < 0 || y >= 10000) {
			return [(go$sliceType(Go$Uint8)).nil, errors.New("Time.MarshalText: year outside of range [0,9999]")];
		}
		return [new (go$sliceType(Go$Uint8))(go$stringToBytes(t.Format("2006-01-02T15:04:05.999999999Z07:00"))), null];
	};
	Time.prototype.MarshalText = function() { return this.go$val.MarshalText(); };
	Time.Ptr.prototype.UnmarshalText = function(data$1) {
		var err, t, _tuple, _struct, l, r;
		err = null;
		t = this;
		_tuple = Parse("2006-01-02T15:04:05Z07:00", go$bytesToString(data$1)), l = t, r = (_struct = _tuple[0], new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc)), l.sec = r.sec, l.nsec = r.nsec, l.loc = r.loc, err = _tuple[1];
		return err;
	};
	Time.prototype.UnmarshalText = function(data$1) { return this.go$val.UnmarshalText(data$1); };
	var Unix = go$pkg.Unix = function(sec, nsec) {
		var n, x, x$1;
		if ((nsec.high < 0 || (nsec.high === 0 && nsec.low < 0)) || (nsec.high > 0 || (nsec.high === 0 && nsec.low >= 1000000000))) {
			n = go$div64(nsec, new Go$Int64(0, 1000000000), false);
			sec = (x = n, new Go$Int64(sec.high + x.high, sec.low + x.low));
			nsec = (x$1 = go$mul64(n, new Go$Int64(0, 1000000000)), new Go$Int64(nsec.high - x$1.high, nsec.low - x$1.low));
			if ((nsec.high < 0 || (nsec.high === 0 && nsec.low < 0))) {
				nsec = new Go$Int64(nsec.high + 0, nsec.low + 1000000000);
				sec = new Go$Int64(sec.high - 0, sec.low - 1);
			}
		}
		return new Time.Ptr(new Go$Int64(sec.high + 14, sec.low + 2006054656), (nsec.low >>> 0), go$pkg.Local);
	};
	var isLeap = function(year) {
		var _r, _r$1, _r$2;
		return ((_r = year % 4, _r === _r ? _r : go$throwRuntimeError("integer divide by zero")) === 0) && (!(((_r$1 = year % 100, _r$1 === _r$1 ? _r$1 : go$throwRuntimeError("integer divide by zero")) === 0)) || ((_r$2 = year % 400, _r$2 === _r$2 ? _r$2 : go$throwRuntimeError("integer divide by zero")) === 0));
	};
	var norm = function(hi, lo, base) {
		var nhi, nlo, _q, n, _q$1, n$1, _tuple;
		nhi = 0;
		nlo = 0;
		if (lo < 0) {
			n = (_q = ((-lo - 1 >> 0)) / base, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero")) + 1 >> 0;
			hi = hi - (n) >> 0;
			lo = lo + (((((n >>> 16 << 16) * base >> 0) + (n << 16 >>> 16) * base) >> 0)) >> 0;
		}
		if (lo >= base) {
			n$1 = (_q$1 = lo / base, (_q$1 === _q$1 && _q$1 !== 1/0 && _q$1 !== -1/0) ? _q$1 >> 0 : go$throwRuntimeError("integer divide by zero"));
			hi = hi + (n$1) >> 0;
			lo = lo - (((((n$1 >>> 16 << 16) * base >> 0) + (n$1 << 16 >>> 16) * base) >> 0)) >> 0;
		}
		_tuple = [hi, lo], nhi = _tuple[0], nlo = _tuple[1];
		return [nhi, nlo];
	};
	var Date = go$pkg.Date = function(year, month, day, hour, min, sec, nsec, loc) {
		var m, _tuple, _tuple$1, _tuple$2, _tuple$3, _tuple$4, x, x$1, y, n, x$2, d, x$3, x$4, x$5, x$6, x$7, x$8, x$9, abs, x$10, x$11, unix, _tuple$5, offset, start, end, x$12, utc, _tuple$6, _tuple$7, x$13;
		if (loc === (go$ptrType(Location)).nil) {
			throw go$panic(new Go$String("time: missing Location in call to Date"));
		}
		m = (month >> 0) - 1 >> 0;
		_tuple = norm(year, m, 12), year = _tuple[0], m = _tuple[1];
		month = (m >> 0) + 1 >> 0;
		_tuple$1 = norm(sec, nsec, 1000000000), sec = _tuple$1[0], nsec = _tuple$1[1];
		_tuple$2 = norm(min, sec, 60), min = _tuple$2[0], sec = _tuple$2[1];
		_tuple$3 = norm(hour, min, 60), hour = _tuple$3[0], min = _tuple$3[1];
		_tuple$4 = norm(day, hour, 24), day = _tuple$4[0], hour = _tuple$4[1];
		y = (x = (x$1 = new Go$Int64(0, year), new Go$Int64(x$1.high - -69, x$1.low - 4075721025)), new Go$Uint64(x.high, x.low));
		n = go$div64(y, new Go$Uint64(0, 400), false);
		y = (x$2 = go$mul64(new Go$Uint64(0, 400), n), new Go$Uint64(y.high - x$2.high, y.low - x$2.low));
		d = go$mul64(new Go$Uint64(0, 146097), n);
		n = go$div64(y, new Go$Uint64(0, 100), false);
		y = (x$3 = go$mul64(new Go$Uint64(0, 100), n), new Go$Uint64(y.high - x$3.high, y.low - x$3.low));
		d = (x$4 = go$mul64(new Go$Uint64(0, 36524), n), new Go$Uint64(d.high + x$4.high, d.low + x$4.low));
		n = go$div64(y, new Go$Uint64(0, 4), false);
		y = (x$5 = go$mul64(new Go$Uint64(0, 4), n), new Go$Uint64(y.high - x$5.high, y.low - x$5.low));
		d = (x$6 = go$mul64(new Go$Uint64(0, 1461), n), new Go$Uint64(d.high + x$6.high, d.low + x$6.low));
		n = y;
		d = (x$7 = go$mul64(new Go$Uint64(0, 365), n), new Go$Uint64(d.high + x$7.high, d.low + x$7.low));
		d = (x$8 = new Go$Uint64(0, daysBefore[(month - 1 >> 0)]), new Go$Uint64(d.high + x$8.high, d.low + x$8.low));
		if (isLeap(year) && month >= 3) {
			d = new Go$Uint64(d.high + 0, d.low + 1);
		}
		d = (x$9 = new Go$Uint64(0, (day - 1 >> 0)), new Go$Uint64(d.high + x$9.high, d.low + x$9.low));
		abs = go$mul64(d, new Go$Uint64(0, 86400));
		abs = (x$10 = new Go$Uint64(0, ((((((hour >>> 16 << 16) * 3600 >> 0) + (hour << 16 >>> 16) * 3600) >> 0) + ((((min >>> 16 << 16) * 60 >> 0) + (min << 16 >>> 16) * 60) >> 0) >> 0) + sec >> 0)), new Go$Uint64(abs.high + x$10.high, abs.low + x$10.low));
		unix = (x$11 = new Go$Int64(abs.high, abs.low), new Go$Int64(x$11.high + -2147483647, x$11.low + 3844486912));
		_tuple$5 = loc.lookup(unix), offset = _tuple$5[1], start = _tuple$5[3], end = _tuple$5[4];
		if (!((offset === 0))) {
			utc = (x$12 = new Go$Int64(0, offset), new Go$Int64(unix.high - x$12.high, unix.low - x$12.low));
			if ((utc.high < start.high || (utc.high === start.high && utc.low < start.low))) {
				_tuple$6 = loc.lookup(new Go$Int64(start.high - 0, start.low - 1)), offset = _tuple$6[1];
			} else if ((utc.high > end.high || (utc.high === end.high && utc.low >= end.low))) {
				_tuple$7 = loc.lookup(end), offset = _tuple$7[1];
			}
			unix = (x$13 = new Go$Int64(0, offset), new Go$Int64(unix.high - x$13.high, unix.low - x$13.low));
		}
		return new Time.Ptr(new Go$Int64(unix.high + 14, unix.low + 2006054656), (nsec >>> 0), loc);
	};
	Time.Ptr.prototype.Truncate = function(d) {
		var _struct, t, _struct$1, _tuple, _struct$2, r, _struct$3;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		if ((d.high < 0 || (d.high === 0 && d.low <= 0))) {
			return (_struct$1 = t, new Time.Ptr(_struct$1.sec, _struct$1.nsec, _struct$1.loc));
		}
		_tuple = div((_struct$2 = t, new Time.Ptr(_struct$2.sec, _struct$2.nsec, _struct$2.loc)), d), r = _tuple[1];
		return (_struct$3 = t.Add(new Duration(-r.high, -r.low)), new Time.Ptr(_struct$3.sec, _struct$3.nsec, _struct$3.loc));
	};
	Time.prototype.Truncate = function(d) { return this.go$val.Truncate(d); };
	Time.Ptr.prototype.Round = function(d) {
		var _struct, t, _struct$1, _tuple, _struct$2, r, x, _struct$3, _struct$4;
		t = (_struct = this, new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		if ((d.high < 0 || (d.high === 0 && d.low <= 0))) {
			return (_struct$1 = t, new Time.Ptr(_struct$1.sec, _struct$1.nsec, _struct$1.loc));
		}
		_tuple = div((_struct$2 = t, new Time.Ptr(_struct$2.sec, _struct$2.nsec, _struct$2.loc)), d), r = _tuple[1];
		if ((x = new Duration(r.high + r.high, r.low + r.low), (x.high < d.high || (x.high === d.high && x.low < d.low)))) {
			return (_struct$3 = t.Add(new Duration(-r.high, -r.low)), new Time.Ptr(_struct$3.sec, _struct$3.nsec, _struct$3.loc));
		}
		return (_struct$4 = t.Add(new Duration(d.high - r.high, d.low - r.low)), new Time.Ptr(_struct$4.sec, _struct$4.nsec, _struct$4.loc));
	};
	Time.prototype.Round = function(d) { return this.go$val.Round(d); };
	var div = function(t, d) {
		var qmod2, r, neg, nsec, x, x$1, x$2, x$3, x$4, _q, _r, x$5, d1, x$6, x$7, x$8, x$9, x$10, sec, tmp, u1, u0, _tuple, u0x, x$11, _tuple$1, d1$1, x$12, d0, _tuple$2, x$13, x$14, x$15;
		qmod2 = 0;
		r = new Duration(0, 0);
		neg = false;
		nsec = (t.nsec >> 0);
		if ((x = t.sec, (x.high < 0 || (x.high === 0 && x.low < 0)))) {
			neg = true;
			t.sec = (x$1 = t.sec, new Go$Int64(-x$1.high, -x$1.low));
			nsec = -nsec;
			if (nsec < 0) {
				nsec = nsec + 1000000000 >> 0;
				t.sec = (x$2 = t.sec, new Go$Int64(x$2.high - 0, x$2.low - 1));
			}
		}
		if ((d.high < 0 || (d.high === 0 && d.low < 1000000000)) && (x$3 = go$div64(new Duration(0, 1000000000), (new Duration(d.high + d.high, d.low + d.low)), true), (x$3.high === 0 && x$3.low === 0))) {
			qmod2 = ((_q = nsec / ((d.low + ((d.high >> 31) * 4294967296)) >> 0), (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero")) >> 0) & 1;
			r = new Duration(0, (_r = nsec % ((d.low + ((d.high >> 31) * 4294967296)) >> 0), _r === _r ? _r : go$throwRuntimeError("integer divide by zero")));
		} else if ((x$4 = go$div64(d, new Duration(0, 1000000000), true), (x$4.high === 0 && x$4.low === 0))) {
			d1 = (x$5 = go$div64(d, new Duration(0, 1000000000), false), new Go$Int64(x$5.high, x$5.low));
			qmod2 = ((x$6 = go$div64(t.sec, d1, false), x$6.low + ((x$6.high >> 31) * 4294967296)) >> 0) & 1;
			r = (x$7 = go$mul64((x$8 = go$div64(t.sec, d1, true), new Duration(x$8.high, x$8.low)), new Duration(0, 1000000000)), x$9 = new Duration(0, nsec), new Duration(x$7.high + x$9.high, x$7.low + x$9.low));
		} else {
			sec = (x$10 = t.sec, new Go$Uint64(x$10.high, x$10.low));
			tmp = go$mul64((go$shiftRightUint64(sec, 32)), new Go$Uint64(0, 1000000000));
			u1 = go$shiftRightUint64(tmp, 32);
			u0 = go$shiftLeft64(tmp, 32);
			tmp = go$mul64(new Go$Uint64(sec.high & 0, (sec.low & 4294967295) >>> 0), new Go$Uint64(0, 1000000000));
			_tuple = [u0, new Go$Uint64(u0.high + tmp.high, u0.low + tmp.low)], u0x = _tuple[0], u0 = _tuple[1];
			if ((u0.high < u0x.high || (u0.high === u0x.high && u0.low < u0x.low))) {
				u1 = new Go$Uint64(u1.high + 0, u1.low + 1);
			}
			_tuple$1 = [u0, (x$11 = new Go$Uint64(0, nsec), new Go$Uint64(u0.high + x$11.high, u0.low + x$11.low))], u0x = _tuple$1[0], u0 = _tuple$1[1];
			if ((u0.high < u0x.high || (u0.high === u0x.high && u0.low < u0x.low))) {
				u1 = new Go$Uint64(u1.high + 0, u1.low + 1);
			}
			d1$1 = new Go$Uint64(d.high, d.low);
			while (!((x$12 = go$shiftRightUint64(d1$1, 63), (x$12.high === 0 && x$12.low === 1)))) {
				d1$1 = go$shiftLeft64(d1$1, 1);
			}
			d0 = new Go$Uint64(0, 0);
			while (true) {
				qmod2 = 0;
				if ((u1.high > d1$1.high || (u1.high === d1$1.high && u1.low > d1$1.low)) || (u1.high === d1$1.high && u1.low === d1$1.low) && (u0.high > d0.high || (u0.high === d0.high && u0.low >= d0.low))) {
					qmod2 = 1;
					_tuple$2 = [u0, new Go$Uint64(u0.high - d0.high, u0.low - d0.low)], u0x = _tuple$2[0], u0 = _tuple$2[1];
					if ((u0.high > u0x.high || (u0.high === u0x.high && u0.low > u0x.low))) {
						u1 = new Go$Uint64(u1.high - 0, u1.low - 1);
					}
					u1 = (x$13 = d1$1, new Go$Uint64(u1.high - x$13.high, u1.low - x$13.low));
				}
				if ((d1$1.high === 0 && d1$1.low === 0) && (x$14 = new Go$Uint64(d.high, d.low), (d0.high === x$14.high && d0.low === x$14.low))) {
					break;
				}
				d0 = go$shiftRightUint64(d0, 1);
				d0 = (x$15 = go$shiftLeft64((new Go$Uint64(d1$1.high & 0, (d1$1.low & 1) >>> 0)), 63), new Go$Uint64(d0.high | x$15.high, (d0.low | x$15.low) >>> 0));
				d1$1 = go$shiftRightUint64(d1$1, 1);
			}
			r = new Duration(u0.high, u0.low);
		}
		if (neg && !((r.high === 0 && r.low === 0))) {
			qmod2 = (qmod2 ^ 1) >> 0;
			r = new Duration(d.high - r.high, d.low - r.low);
		}
		return [qmod2, r];
	};
	Location.Ptr.prototype.get = function() {
		var l;
		l = this;
		if (l === (go$ptrType(Location)).nil) {
			return utcLoc;
		}
		if (l === localLoc) {
			localOnce.Do(initLocal);
		}
		return l;
	};
	Location.prototype.get = function() { return this.go$val.get(); };
	Location.Ptr.prototype.String = function() {
		var l;
		l = this;
		return l.get().name;
	};
	Location.prototype.String = function() { return this.go$val.String(); };
	var FixedZone = go$pkg.FixedZone = function(name, offset) {
		var l, _slice, _index;
		l = new Location.Ptr(name, new (go$sliceType(zone))([new zone.Ptr(name, offset, false)]), new (go$sliceType(zoneTrans))([new zoneTrans.Ptr(new Go$Int64(-2147483648, 0), 0, false, false)]), new Go$Int64(-2147483648, 0), new Go$Int64(2147483647, 4294967295), (go$ptrType(zone)).nil);
		l.cacheZone = (_slice = l.zone, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range"));
		return l;
	};
	Location.Ptr.prototype.lookup = function(sec) {
		var name, offset, isDST, start, end, l, zone$1, x, x$1, tx, lo, hi, _q, m, _slice, _index, lim, _slice$1, _index$1, _slice$2, _index$2, zone$2, _slice$3, _index$3;
		name = "";
		offset = 0;
		isDST = false;
		start = new Go$Int64(0, 0);
		end = new Go$Int64(0, 0);
		l = this;
		l = l.get();
		if (l.tx.length === 0) {
			name = "UTC";
			offset = 0;
			isDST = false;
			start = new Go$Int64(-2147483648, 0);
			end = new Go$Int64(2147483647, 4294967295);
			return [name, offset, isDST, start, end];
		}
		if (zone$1 = l.cacheZone, !(zone$1 === (go$ptrType(zone)).nil) && (x = l.cacheStart, (x.high < sec.high || (x.high === sec.high && x.low <= sec.low))) && (x$1 = l.cacheEnd, (sec.high < x$1.high || (sec.high === x$1.high && sec.low < x$1.low)))) {
			name = zone$1.name;
			offset = zone$1.offset;
			isDST = zone$1.isDST;
			start = l.cacheStart;
			end = l.cacheEnd;
			return [name, offset, isDST, start, end];
		}
		tx = l.tx;
		end = new Go$Int64(2147483647, 4294967295);
		lo = 0;
		hi = tx.length;
		while ((hi - lo >> 0) > 1) {
			m = lo + (_q = ((hi - lo >> 0)) / 2, (_q === _q && _q !== 1/0 && _q !== -1/0) ? _q >> 0 : go$throwRuntimeError("integer divide by zero")) >> 0;
			lim = (_slice = tx, _index = m, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")).when;
			if ((sec.high < lim.high || (sec.high === lim.high && sec.low < lim.low))) {
				end = lim;
				hi = m;
			} else {
				lo = m;
			}
		}
		zone$2 = (_slice$1 = l.zone, _index$1 = (_slice$2 = tx, _index$2 = lo, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")).index, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range"));
		name = zone$2.name;
		offset = zone$2.offset;
		isDST = zone$2.isDST;
		start = (_slice$3 = tx, _index$3 = lo, (_index$3 >= 0 && _index$3 < _slice$3.length) ? _slice$3.array[_slice$3.offset + _index$3] : go$throwRuntimeError("index out of range")).when;
		return [name, offset, isDST, start, end];
	};
	Location.prototype.lookup = function(sec) { return this.go$val.lookup(sec); };
	Location.Ptr.prototype.lookupName = function(name, unix) {
		var offset, isDST, ok, l, _ref, _i, i, _slice, _index, zone$1, _tuple, x, nam, offset$1, isDST$1, _tuple$1, _ref$1, _i$1, i$1, _slice$1, _index$1, zone$2, _tuple$2;
		offset = 0;
		isDST = false;
		ok = false;
		l = this;
		l = l.get();
		_ref = l.zone;
		_i = 0;
		while (_i < _ref.length) {
			i = _i;
			zone$1 = (_slice = l.zone, _index = i, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range"));
			if (zone$1.name === name) {
				_tuple = l.lookup((x = new Go$Int64(0, zone$1.offset), new Go$Int64(unix.high - x.high, unix.low - x.low))), nam = _tuple[0], offset$1 = _tuple[1], isDST$1 = _tuple[2];
				if (nam === zone$1.name) {
					_tuple$1 = [offset$1, isDST$1, true], offset = _tuple$1[0], isDST = _tuple$1[1], ok = _tuple$1[2];
					return [offset, isDST, ok];
				}
			}
			_i++;
		}
		_ref$1 = l.zone;
		_i$1 = 0;
		while (_i$1 < _ref$1.length) {
			i$1 = _i$1;
			zone$2 = (_slice$1 = l.zone, _index$1 = i$1, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range"));
			if (zone$2.name === name) {
				_tuple$2 = [zone$2.offset, zone$2.isDST, true], offset = _tuple$2[0], isDST = _tuple$2[1], ok = _tuple$2[2];
				return [offset, isDST, ok];
			}
			_i$1++;
		}
		return [offset, isDST, ok];
	};
	Location.prototype.lookupName = function(name, unix) { return this.go$val.lookupName(name, unix); };
	var LoadLocation = go$pkg.LoadLocation = function(name) {
		var err, _tuple, z;
		if (name === "" || name === "UTC") {
			return [go$pkg.UTC, null];
		}
		if (name === "Local") {
			return [go$pkg.Local, null];
		}
		if (!(zoneinfo === "")) {
			if (_tuple = loadZoneFile(zoneinfo, name), z = _tuple[0], err = _tuple[1], go$interfaceIsEqual(err, null)) {
				z.name = name;
				return [z, null];
			}
		}
		return loadLocation(name);
	};
	data.Ptr.prototype.read = function(n) {
		var d, p;
		d = this;
		if (d.p.length < n) {
			d.p = (go$sliceType(Go$Uint8)).nil;
			d.error = true;
			return (go$sliceType(Go$Uint8)).nil;
		}
		p = go$subslice(d.p, 0, n);
		d.p = go$subslice(d.p, n);
		return p;
	};
	data.prototype.read = function(n) { return this.go$val.read(n); };
	data.Ptr.prototype.big4 = function() {
		var n, ok, d, p, _tuple, _slice, _index, _slice$1, _index$1, _slice$2, _index$2, _slice$3, _index$3, _tuple$1;
		n = 0;
		ok = false;
		d = this;
		p = d.read(4);
		if (p.length < 4) {
			d.error = true;
			_tuple = [0, false], n = _tuple[0], ok = _tuple[1];
			return [n, ok];
		}
		_tuple$1 = [((((((((_slice = p, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) >>> 0) << 24 >>> 0) | (((_slice$1 = p, _index$1 = 1, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")) >>> 0) << 16 >>> 0)) >>> 0) | (((_slice$2 = p, _index$2 = 2, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")) >>> 0) << 8 >>> 0)) >>> 0) | ((_slice$3 = p, _index$3 = 3, (_index$3 >= 0 && _index$3 < _slice$3.length) ? _slice$3.array[_slice$3.offset + _index$3] : go$throwRuntimeError("index out of range")) >>> 0)) >>> 0, true], n = _tuple$1[0], ok = _tuple$1[1];
		return [n, ok];
	};
	data.prototype.big4 = function() { return this.go$val.big4(); };
	data.Ptr.prototype.byte$ = function() {
		var n, ok, d, p, _tuple, _slice, _index, _tuple$1;
		n = 0;
		ok = false;
		d = this;
		p = d.read(1);
		if (p.length < 1) {
			d.error = true;
			_tuple = [0, false], n = _tuple[0], ok = _tuple[1];
			return [n, ok];
		}
		_tuple$1 = [(_slice = p, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")), true], n = _tuple$1[0], ok = _tuple$1[1];
		return [n, ok];
	};
	data.prototype.byte$ = function() { return this.go$val.byte$(); };
	var byteString = function(p) {
		var i, _slice, _index;
		i = 0;
		while (i < p.length) {
			if ((_slice = p, _index = i, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) === 0) {
				return go$bytesToString(go$subslice(p, 0, i));
			}
			i = i + 1 >> 0;
		}
		return go$bytesToString(p);
	};
	var loadZoneData = function(bytes) {
		var l, err, d, magic, _tuple, p, _slice, _index, _slice$1, _index$1, _tuple$1, n, i, _tuple$2, nn, ok, _tuple$3, x, x$1, txtimes, txzones, x$2, x$3, zonedata, abbrev$1, x$4, x$5, isstd, isutc, _tuple$4, zone$1, _ref, _i, i$1, ok$1, n$1, _tuple$5, _tuple$6, _slice$2, _index$2, b, _tuple$7, _tuple$8, _slice$3, _index$3, _tuple$9, _tuple$10, _slice$4, _index$4, tx, _ref$1, _i$1, i$2, ok$2, n$2, _tuple$11, _tuple$12, _slice$5, _index$5, _slice$6, _index$6, _tuple$13, _slice$7, _index$7, _slice$8, _index$8, _slice$9, _index$9, _slice$10, _index$10, _slice$11, _index$11, _slice$12, _index$12, _tuple$14, sec, _ref$2, _i$2, i$3, x$6, _slice$13, _index$13, x$7, _slice$14, _index$14, _slice$15, _index$15, _slice$16, _index$16, _slice$17, _index$17, _slice$18, _index$18, _tuple$15;
		l = (go$ptrType(Location)).nil;
		err = null;
		d = new data.Ptr(bytes, false);
		if (magic = d.read(4), !(go$bytesToString(magic) === "TZif")) {
			_tuple = [(go$ptrType(Location)).nil, badData], l = _tuple[0], err = _tuple[1];
			return [l, err];
		}
		p = (go$sliceType(Go$Uint8)).nil;
		if (p = d.read(16), !((p.length === 16)) || !(((_slice = p, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) === 0)) && !(((_slice$1 = p, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")) === 50))) {
			_tuple$1 = [(go$ptrType(Location)).nil, badData], l = _tuple$1[0], err = _tuple$1[1];
			return [l, err];
		}
		n = go$makeNativeArray("Int", 6, function() { return 0; });
		i = 0;
		while (i < 6) {
			_tuple$2 = d.big4(), nn = _tuple$2[0], ok = _tuple$2[1];
			if (!ok) {
				_tuple$3 = [(go$ptrType(Location)).nil, badData], l = _tuple$3[0], err = _tuple$3[1];
				return [l, err];
			}
			n[i] = (nn >> 0);
			i = i + 1 >> 0;
		}
		txtimes = new data.Ptr(d.read((x = n[3], x$1 = 4, (((x >>> 16 << 16) * x$1 >> 0) + (x << 16 >>> 16) * x$1) >> 0)), false);
		txzones = d.read(n[3]);
		zonedata = new data.Ptr(d.read((x$2 = n[4], x$3 = 6, (((x$2 >>> 16 << 16) * x$3 >> 0) + (x$2 << 16 >>> 16) * x$3) >> 0)), false);
		abbrev$1 = d.read(n[5]);
		d.read((x$4 = n[2], x$5 = 8, (((x$4 >>> 16 << 16) * x$5 >> 0) + (x$4 << 16 >>> 16) * x$5) >> 0));
		isstd = d.read(n[1]);
		isutc = d.read(n[0]);
		if (d.error) {
			_tuple$4 = [(go$ptrType(Location)).nil, badData], l = _tuple$4[0], err = _tuple$4[1];
			return [l, err];
		}
		zone$1 = (go$sliceType(zone)).make(n[4], 0, function() { return new zone.Ptr(); });
		_ref = zone$1;
		_i = 0;
		while (_i < _ref.length) {
			i$1 = _i;
			ok$1 = false;
			n$1 = 0;
			if (_tuple$5 = zonedata.big4(), n$1 = _tuple$5[0], ok$1 = _tuple$5[1], !ok$1) {
				_tuple$6 = [(go$ptrType(Location)).nil, badData], l = _tuple$6[0], err = _tuple$6[1];
				return [l, err];
			}
			(_slice$2 = zone$1, _index$2 = i$1, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")).offset = ((n$1 >> 0) >> 0);
			b = 0;
			if (_tuple$7 = zonedata.byte$(), b = _tuple$7[0], ok$1 = _tuple$7[1], !ok$1) {
				_tuple$8 = [(go$ptrType(Location)).nil, badData], l = _tuple$8[0], err = _tuple$8[1];
				return [l, err];
			}
			(_slice$3 = zone$1, _index$3 = i$1, (_index$3 >= 0 && _index$3 < _slice$3.length) ? _slice$3.array[_slice$3.offset + _index$3] : go$throwRuntimeError("index out of range")).isDST = !((b === 0));
			if (_tuple$9 = zonedata.byte$(), b = _tuple$9[0], ok$1 = _tuple$9[1], !ok$1 || (b >> 0) >= abbrev$1.length) {
				_tuple$10 = [(go$ptrType(Location)).nil, badData], l = _tuple$10[0], err = _tuple$10[1];
				return [l, err];
			}
			(_slice$4 = zone$1, _index$4 = i$1, (_index$4 >= 0 && _index$4 < _slice$4.length) ? _slice$4.array[_slice$4.offset + _index$4] : go$throwRuntimeError("index out of range")).name = byteString(go$subslice(abbrev$1, b));
			_i++;
		}
		tx = (go$sliceType(zoneTrans)).make(n[3], 0, function() { return new zoneTrans.Ptr(); });
		_ref$1 = tx;
		_i$1 = 0;
		while (_i$1 < _ref$1.length) {
			i$2 = _i$1;
			ok$2 = false;
			n$2 = 0;
			if (_tuple$11 = txtimes.big4(), n$2 = _tuple$11[0], ok$2 = _tuple$11[1], !ok$2) {
				_tuple$12 = [(go$ptrType(Location)).nil, badData], l = _tuple$12[0], err = _tuple$12[1];
				return [l, err];
			}
			(_slice$5 = tx, _index$5 = i$2, (_index$5 >= 0 && _index$5 < _slice$5.length) ? _slice$5.array[_slice$5.offset + _index$5] : go$throwRuntimeError("index out of range")).when = new Go$Int64(0, (n$2 >> 0));
			if (((_slice$6 = txzones, _index$6 = i$2, (_index$6 >= 0 && _index$6 < _slice$6.length) ? _slice$6.array[_slice$6.offset + _index$6] : go$throwRuntimeError("index out of range")) >> 0) >= zone$1.length) {
				_tuple$13 = [(go$ptrType(Location)).nil, badData], l = _tuple$13[0], err = _tuple$13[1];
				return [l, err];
			}
			(_slice$8 = tx, _index$8 = i$2, (_index$8 >= 0 && _index$8 < _slice$8.length) ? _slice$8.array[_slice$8.offset + _index$8] : go$throwRuntimeError("index out of range")).index = (_slice$7 = txzones, _index$7 = i$2, (_index$7 >= 0 && _index$7 < _slice$7.length) ? _slice$7.array[_slice$7.offset + _index$7] : go$throwRuntimeError("index out of range"));
			if (i$2 < isstd.length) {
				(_slice$10 = tx, _index$10 = i$2, (_index$10 >= 0 && _index$10 < _slice$10.length) ? _slice$10.array[_slice$10.offset + _index$10] : go$throwRuntimeError("index out of range")).isstd = !(((_slice$9 = isstd, _index$9 = i$2, (_index$9 >= 0 && _index$9 < _slice$9.length) ? _slice$9.array[_slice$9.offset + _index$9] : go$throwRuntimeError("index out of range")) === 0));
			}
			if (i$2 < isutc.length) {
				(_slice$12 = tx, _index$12 = i$2, (_index$12 >= 0 && _index$12 < _slice$12.length) ? _slice$12.array[_slice$12.offset + _index$12] : go$throwRuntimeError("index out of range")).isutc = !(((_slice$11 = isutc, _index$11 = i$2, (_index$11 >= 0 && _index$11 < _slice$11.length) ? _slice$11.array[_slice$11.offset + _index$11] : go$throwRuntimeError("index out of range")) === 0));
			}
			_i$1++;
		}
		if (tx.length === 0) {
			tx = go$append(tx, new zoneTrans.Ptr(new Go$Int64(-2147483648, 0), 0, false, false));
		}
		l = new Location.Ptr("", zone$1, tx, new Go$Int64(0, 0), new Go$Int64(0, 0), (go$ptrType(zone)).nil);
		_tuple$14 = now(), sec = _tuple$14[0];
		_ref$2 = tx;
		_i$2 = 0;
		while (_i$2 < _ref$2.length) {
			i$3 = _i$2;
			if ((x$6 = (_slice$13 = tx, _index$13 = i$3, (_index$13 >= 0 && _index$13 < _slice$13.length) ? _slice$13.array[_slice$13.offset + _index$13] : go$throwRuntimeError("index out of range")).when, (x$6.high < sec.high || (x$6.high === sec.high && x$6.low <= sec.low))) && (((i$3 + 1 >> 0) === tx.length) || (x$7 = (_slice$14 = tx, _index$14 = (i$3 + 1 >> 0), (_index$14 >= 0 && _index$14 < _slice$14.length) ? _slice$14.array[_slice$14.offset + _index$14] : go$throwRuntimeError("index out of range")).when, (sec.high < x$7.high || (sec.high === x$7.high && sec.low < x$7.low))))) {
				l.cacheStart = (_slice$15 = tx, _index$15 = i$3, (_index$15 >= 0 && _index$15 < _slice$15.length) ? _slice$15.array[_slice$15.offset + _index$15] : go$throwRuntimeError("index out of range")).when;
				l.cacheEnd = new Go$Int64(2147483647, 4294967295);
				if ((i$3 + 1 >> 0) < tx.length) {
					l.cacheEnd = (_slice$16 = tx, _index$16 = (i$3 + 1 >> 0), (_index$16 >= 0 && _index$16 < _slice$16.length) ? _slice$16.array[_slice$16.offset + _index$16] : go$throwRuntimeError("index out of range")).when;
				}
				l.cacheZone = (_slice$17 = l.zone, _index$17 = (_slice$18 = tx, _index$18 = i$3, (_index$18 >= 0 && _index$18 < _slice$18.length) ? _slice$18.array[_slice$18.offset + _index$18] : go$throwRuntimeError("index out of range")).index, (_index$17 >= 0 && _index$17 < _slice$17.length) ? _slice$17.array[_slice$17.offset + _index$17] : go$throwRuntimeError("index out of range"));
			}
			_i$2++;
		}
		_tuple$15 = [l, null], l = _tuple$15[0], err = _tuple$15[1];
		return [l, err];
	};
	var loadZoneFile = function(dir, name) {
		var l, err, _tuple, _tuple$1, buf, _tuple$2;
		l = (go$ptrType(Location)).nil;
		err = null;
		if (dir.length > 4 && dir.substring((dir.length - 4 >> 0)) === ".zip") {
			_tuple = loadZoneZip(dir, name), l = _tuple[0], err = _tuple[1];
			return [l, err];
		}
		if (!(dir === "")) {
			name = dir + "/" + name;
		}
		_tuple$1 = readFile(name), buf = _tuple$1[0], err = _tuple$1[1];
		if (!(go$interfaceIsEqual(err, null))) {
			return [l, err];
		}
		_tuple$2 = loadZoneData(buf), l = _tuple$2[0], err = _tuple$2[1];
		return [l, err];
	};
	var get4 = function(b) {
		var _slice, _index, _slice$1, _index$1, _slice$2, _index$2, _slice$3, _index$3;
		if (b.length < 4) {
			return 0;
		}
		return ((((_slice = b, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) >> 0) | (((_slice$1 = b, _index$1 = 1, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")) >> 0) << 8 >> 0)) | (((_slice$2 = b, _index$2 = 2, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")) >> 0) << 16 >> 0)) | (((_slice$3 = b, _index$3 = 3, (_index$3 >= 0 && _index$3 < _slice$3.length) ? _slice$3.array[_slice$3.offset + _index$3] : go$throwRuntimeError("index out of range")) >> 0) << 24 >> 0);
	};
	var get2 = function(b) {
		var _slice, _index, _slice$1, _index$1;
		if (b.length < 2) {
			return 0;
		}
		return ((_slice = b, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range")) >> 0) | (((_slice$1 = b, _index$1 = 1, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")) >> 0) << 8 >> 0);
	};
	var loadZoneZip = function(zipfile, name) {
		var l, err, _tuple, fd, _tuple$1, buf, err$1, _tuple$2, n, size, off, err$2, _tuple$3, i, meth, size$1, namelen, xlen, fclen, off$1, zname, _tuple$4, err$3, _tuple$5, err$4, _tuple$6, _tuple$7, _tuple$8;
		l = (go$ptrType(Location)).nil;
		err = null;
		var go$deferred = [];
		try {
			_tuple = open(zipfile), fd = _tuple[0], err = _tuple[1];
			if (!(go$interfaceIsEqual(err, null))) {
				_tuple$1 = [(go$ptrType(Location)).nil, errors.New("open " + zipfile + ": " + err.Error())], l = _tuple$1[0], err = _tuple$1[1];
				return [l, err];
			}
			go$deferred.push({ fun: closefd, args: [fd] });
			buf = (go$sliceType(Go$Uint8)).make(22, 0, function() { return 0; });
			if (err$1 = preadn(fd, buf, -22), !(go$interfaceIsEqual(err$1, null)) || !((get4(buf) === 101010256))) {
				_tuple$2 = [(go$ptrType(Location)).nil, errors.New("corrupt zip file " + zipfile)], l = _tuple$2[0], err = _tuple$2[1];
				return [l, err];
			}
			n = get2(go$subslice(buf, 10));
			size = get4(go$subslice(buf, 12));
			off = get4(go$subslice(buf, 16));
			buf = (go$sliceType(Go$Uint8)).make(size, 0, function() { return 0; });
			if (err$2 = preadn(fd, buf, off), !(go$interfaceIsEqual(err$2, null))) {
				_tuple$3 = [(go$ptrType(Location)).nil, errors.New("corrupt zip file " + zipfile)], l = _tuple$3[0], err = _tuple$3[1];
				return [l, err];
			}
			i = 0;
			while (i < n) {
				if (!((get4(buf) === 33639248))) {
					break;
				}
				meth = get2(go$subslice(buf, 10));
				size$1 = get4(go$subslice(buf, 24));
				namelen = get2(go$subslice(buf, 28));
				xlen = get2(go$subslice(buf, 30));
				fclen = get2(go$subslice(buf, 32));
				off$1 = get4(go$subslice(buf, 42));
				zname = go$subslice(buf, 46, (46 + namelen >> 0));
				buf = go$subslice(buf, (((46 + namelen >> 0) + xlen >> 0) + fclen >> 0));
				if (!(go$bytesToString(zname) === name)) {
					i = i + 1 >> 0;
					continue;
				}
				if (!((meth === 0))) {
					_tuple$4 = [(go$ptrType(Location)).nil, errors.New("unsupported compression for " + name + " in " + zipfile)], l = _tuple$4[0], err = _tuple$4[1];
					return [l, err];
				}
				buf = (go$sliceType(Go$Uint8)).make(30 + namelen >> 0, 0, function() { return 0; });
				if (err$3 = preadn(fd, buf, off$1), !(go$interfaceIsEqual(err$3, null)) || !((get4(buf) === 67324752)) || !((get2(go$subslice(buf, 8)) === meth)) || !((get2(go$subslice(buf, 26)) === namelen)) || !(go$bytesToString(go$subslice(buf, 30, (30 + namelen >> 0))) === name)) {
					_tuple$5 = [(go$ptrType(Location)).nil, errors.New("corrupt zip file " + zipfile)], l = _tuple$5[0], err = _tuple$5[1];
					return [l, err];
				}
				xlen = get2(go$subslice(buf, 28));
				buf = (go$sliceType(Go$Uint8)).make(size$1, 0, function() { return 0; });
				if (err$4 = preadn(fd, buf, ((off$1 + 30 >> 0) + namelen >> 0) + xlen >> 0), !(go$interfaceIsEqual(err$4, null))) {
					_tuple$6 = [(go$ptrType(Location)).nil, errors.New("corrupt zip file " + zipfile)], l = _tuple$6[0], err = _tuple$6[1];
					return [l, err];
				}
				_tuple$7 = loadZoneData(buf), l = _tuple$7[0], err = _tuple$7[1];
				return [l, err];
			}
			_tuple$8 = [(go$ptrType(Location)).nil, errors.New("cannot find " + name + " in zip file " + zipfile)], l = _tuple$8[0], err = _tuple$8[1];
			return [l, err];
		} catch(go$err) {
			go$pushErr(go$err);
		} finally {
			go$callDeferred(go$deferred);
			return [l, err];
		}
	};
	var getKeyValue = function(kh, kname) {
		var buf, typ, n, _tuple, p, err, v, v$1;
		buf = go$makeNativeArray("Uint16", 50, function() { return 0; });
		typ = 0;
		n = 100;
		_tuple = syscall.UTF16PtrFromString(kname), p = _tuple[0];
		if (err = syscall.RegQueryValueEx(kh, p, (go$ptrType(Go$Uint32)).nil, new (go$ptrType(Go$Uint32))(function() { return typ; }, function(v) { typ = v; }), go$sliceToArray(new (go$sliceType(Go$Uint8))(buf)), new (go$ptrType(Go$Uint32))(function() { return n; }, function(v$1) { n = v$1; })), !(go$interfaceIsEqual(err, null))) {
			return ["", err];
		}
		if (!((typ === 1))) {
			return ["", errors.New("Key is not string")];
		}
		return [syscall.UTF16ToString(new (go$sliceType(Go$Uint16))(buf)), null];
	};
	var matchZoneKey = function(zones, kname, stdname, dstname) {
		var matched, err2, h, _tuple, p, err, v, _tuple$1, _tuple$2, s, err$1, _tuple$3, _tuple$4, _tuple$5, _tuple$6, _tuple$7, _tuple$8;
		matched = false;
		err2 = null;
		var go$deferred = [];
		try {
			h = 0;
			_tuple = syscall.UTF16PtrFromString(kname), p = _tuple[0];
			if (err = syscall.RegOpenKeyEx(zones, p, 0, 131097, new (go$ptrType(syscall.Handle))(function() { return h; }, function(v) { h = v; })), !(go$interfaceIsEqual(err, null))) {
				_tuple$1 = [false, err], matched = _tuple$1[0], err2 = _tuple$1[1];
				return [matched, err2];
			}
			go$deferred.push({ recv: syscall, method: "RegCloseKey", args: [h] });
			_tuple$2 = getKeyValue(h, "Std"), s = _tuple$2[0], err$1 = _tuple$2[1];
			if (!(go$interfaceIsEqual(err$1, null))) {
				_tuple$3 = [false, err$1], matched = _tuple$3[0], err2 = _tuple$3[1];
				return [matched, err2];
			}
			if (!(s === stdname)) {
				_tuple$4 = [false, null], matched = _tuple$4[0], err2 = _tuple$4[1];
				return [matched, err2];
			}
			_tuple$5 = getKeyValue(h, "Dlt"), s = _tuple$5[0], err$1 = _tuple$5[1];
			if (!(go$interfaceIsEqual(err$1, null))) {
				_tuple$6 = [false, err$1], matched = _tuple$6[0], err2 = _tuple$6[1];
				return [matched, err2];
			}
			if (!(s === dstname)) {
				_tuple$7 = [false, null], matched = _tuple$7[0], err2 = _tuple$7[1];
				return [matched, err2];
			}
			_tuple$8 = [true, null], matched = _tuple$8[0], err2 = _tuple$8[1];
			return [matched, err2];
		} catch(go$err) {
			go$pushErr(go$err);
		} finally {
			go$callDeferred(go$deferred);
			return [matched, err2];
		}
	};
	var toEnglishName = function(stdname, dstname) {
		var zones, _tuple, p, err, v, count, err$1, v$1, buf, i, n, v$2, v$3, kname, _tuple$1, matched, err$2;
		var go$deferred = [];
		try {
			zones = 0;
			_tuple = syscall.UTF16PtrFromString("SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Time Zones"), p = _tuple[0];
			if (err = syscall.RegOpenKeyEx(2147483650, p, 0, 131097, new (go$ptrType(syscall.Handle))(function() { return zones; }, function(v) { zones = v; })), !(go$interfaceIsEqual(err, null))) {
				return ["", err];
			}
			go$deferred.push({ recv: syscall, method: "RegCloseKey", args: [zones] });
			count = 0;
			if (err$1 = syscall.RegQueryInfoKey(zones, (go$ptrType(Go$Uint16)).nil, (go$ptrType(Go$Uint32)).nil, (go$ptrType(Go$Uint32)).nil, new (go$ptrType(Go$Uint32))(function() { return count; }, function(v$1) { count = v$1; }), (go$ptrType(Go$Uint32)).nil, (go$ptrType(Go$Uint32)).nil, (go$ptrType(Go$Uint32)).nil, (go$ptrType(Go$Uint32)).nil, (go$ptrType(Go$Uint32)).nil, (go$ptrType(Go$Uint32)).nil, (go$ptrType(syscall.Filetime)).nil), !(go$interfaceIsEqual(err$1, null))) {
				return ["", err$1];
			}
			buf = go$makeNativeArray("Uint16", 50, function() { return 0; });
			i = 0;
			while (i < count) {
				n = [undefined];
				n[0] = 50;
				if (!(go$interfaceIsEqual(syscall.RegEnumKeyEx(zones, i, (function(n) { return new (go$ptrType(Go$Uint16))(function() { return buf[0]; }, function(v$2) { buf[0] = v$2; }); })(n), (function(n) { return new (go$ptrType(Go$Uint32))(function() { return n[0]; }, function(v$3) { n[0] = v$3; }); })(n), (go$ptrType(Go$Uint32)).nil, (go$ptrType(Go$Uint16)).nil, (go$ptrType(Go$Uint32)).nil, (go$ptrType(syscall.Filetime)).nil), null))) {
					i = i + 1 >>> 0;
					continue;
				}
				kname = syscall.UTF16ToString(new (go$sliceType(Go$Uint16))(buf));
				_tuple$1 = matchZoneKey(zones, kname, stdname, dstname), matched = _tuple$1[0], err$2 = _tuple$1[1];
				if (go$interfaceIsEqual(err$2, null) && matched) {
					return [kname, null];
				}
				i = i + 1 >>> 0;
			}
			return ["", errors.New("English name for time zone \"" + stdname + "\" not found in registry")];
		} catch(go$err) {
			go$pushErr(go$err);
			return ["", null];
		} finally {
			go$callDeferred(go$deferred);
		}
	};
	var extractCAPS = function(desc) {
		var short$1, _ref, _i, _rune, c;
		short$1 = (go$sliceType(Go$Int32)).nil;
		_ref = desc;
		_i = 0;
		while (_i < _ref.length) {
			_rune = go$decodeRune(_ref, _i);
			c = _rune[0];
			if (65 <= c && c <= 90) {
				short$1 = go$append(short$1, c);
			}
			_i += _rune[1];
		}
		return go$runesToString(short$1);
	};
	var abbrev = function(z) {
		var std, dst, stdName, _tuple, _entry, _struct, a, ok, dstName, _tuple$1, englishName, err, _tuple$2, _entry$1, _struct$1, _tuple$3, _tuple$4, _tuple$5;
		std = "";
		dst = "";
		stdName = syscall.UTF16ToString(new (go$sliceType(Go$Uint16))(z.StandardName));
		_tuple = (_entry = abbrs[stdName], _entry !== undefined ? [_entry.v, true] : [new abbr.Ptr(), false]), a = (_struct = _tuple[0], new abbr.Ptr(_struct.std, _struct.dst)), ok = _tuple[1];
		if (!ok) {
			dstName = syscall.UTF16ToString(new (go$sliceType(Go$Uint16))(z.DaylightName));
			_tuple$1 = toEnglishName(stdName, dstName), englishName = _tuple$1[0], err = _tuple$1[1];
			if (go$interfaceIsEqual(err, null)) {
				_tuple$2 = (_entry$1 = abbrs[englishName], _entry$1 !== undefined ? [_entry$1.v, true] : [new abbr.Ptr(), false]), a = (_struct$1 = _tuple$2[0], new abbr.Ptr(_struct$1.std, _struct$1.dst)), ok = _tuple$2[1];
				if (ok) {
					_tuple$3 = [a.std, a.dst], std = _tuple$3[0], dst = _tuple$3[1];
					return [std, dst];
				}
			}
			_tuple$4 = [extractCAPS(stdName), extractCAPS(dstName)], std = _tuple$4[0], dst = _tuple$4[1];
			return [std, dst];
		}
		_tuple$5 = [a.std, a.dst], std = _tuple$5[0], dst = _tuple$5[1];
		return [std, dst];
	};
	var pseudoUnix = function(year, d) {
		var day, _struct, t, i, week, x, x$1, x$2, x$3;
		day = 1;
		t = (_struct = Date(year, (d.Month >> 0), day, (d.Hour >> 0), (d.Minute >> 0), (d.Second >> 0), 0, go$pkg.UTC), new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		i = (d.DayOfWeek >> 0) - (t.Weekday() >> 0) >> 0;
		if (i < 0) {
			i = i + 7 >> 0;
		}
		day = day + (i) >> 0;
		if (week = (d.Day >> 0) - 1 >> 0, week < 4) {
			day = day + ((x = 7, (((week >>> 16 << 16) * x >> 0) + (week << 16 >>> 16) * x) >> 0)) >> 0;
		} else {
			day = day + 28 >> 0;
			if (day > daysIn((d.Month >> 0), year)) {
				day = day - 7 >> 0;
			}
		}
		return (x$1 = (x$2 = t.sec, x$3 = go$mul64(new Go$Int64(0, (day - 1 >> 0)), new Go$Int64(0, 86400)), new Go$Int64(x$2.high + x$3.high, x$2.low + x$3.low)), new Go$Int64(x$1.high + -15, x$1.low + 2288912640));
	};
	var initLocalFromTZI = function(i) {
		var l, nzone, _tuple, stdname, dstname, _slice, _index, std, x, x$1, _slice$1, _index$1, _slice$2, _index$2, x$2, x$3, _slice$3, _index$3, dst, x$4, x$5, d0, d1, i0, i1, _tuple$1, _tuple$2, _struct, t, year, txi, y, _slice$4, _index$4, tx, x$6, x$7, _slice$5, _index$5, _slice$6, _index$6, x$8, x$9, _slice$7, _index$7;
		l = localLoc;
		nzone = 1;
		if (i.StandardDate.Month > 0) {
			nzone = nzone + 1 >> 0;
		}
		l.zone = (go$sliceType(zone)).make(nzone, 0, function() { return new zone.Ptr(); });
		_tuple = abbrev(i), stdname = _tuple[0], dstname = _tuple[1];
		std = (_slice = l.zone, _index = 0, (_index >= 0 && _index < _slice.length) ? _slice.array[_slice.offset + _index] : go$throwRuntimeError("index out of range"));
		std.name = stdname;
		if (nzone === 1) {
			std.offset = (x = -(i.Bias >> 0), x$1 = 60, (((x >>> 16 << 16) * x$1 >> 0) + (x << 16 >>> 16) * x$1) >> 0);
			l.cacheStart = new Go$Int64(-2147483648, 0);
			l.cacheEnd = new Go$Int64(2147483647, 4294967295);
			l.cacheZone = std;
			l.tx = (go$sliceType(zoneTrans)).make(1, 0, function() { return new zoneTrans.Ptr(); });
			(_slice$1 = l.tx, _index$1 = 0, (_index$1 >= 0 && _index$1 < _slice$1.length) ? _slice$1.array[_slice$1.offset + _index$1] : go$throwRuntimeError("index out of range")).when = l.cacheStart;
			(_slice$2 = l.tx, _index$2 = 0, (_index$2 >= 0 && _index$2 < _slice$2.length) ? _slice$2.array[_slice$2.offset + _index$2] : go$throwRuntimeError("index out of range")).index = 0;
			return;
		}
		std.offset = (x$2 = -((i.Bias + i.StandardBias >> 0) >> 0), x$3 = 60, (((x$2 >>> 16 << 16) * x$3 >> 0) + (x$2 << 16 >>> 16) * x$3) >> 0);
		dst = (_slice$3 = l.zone, _index$3 = 1, (_index$3 >= 0 && _index$3 < _slice$3.length) ? _slice$3.array[_slice$3.offset + _index$3] : go$throwRuntimeError("index out of range"));
		dst.name = dstname;
		dst.offset = (x$4 = -((i.Bias + i.DaylightBias >> 0) >> 0), x$5 = 60, (((x$4 >>> 16 << 16) * x$5 >> 0) + (x$4 << 16 >>> 16) * x$5) >> 0);
		dst.isDST = true;
		d0 = i.StandardDate;
		d1 = i.DaylightDate;
		i0 = 0;
		i1 = 1;
		if (d0.Month > d1.Month) {
			_tuple$1 = [d1, d0], d0 = _tuple$1[0], d1 = _tuple$1[1];
			_tuple$2 = [i1, i0], i0 = _tuple$2[0], i1 = _tuple$2[1];
		}
		l.tx = (go$sliceType(zoneTrans)).make(400, 0, function() { return new zoneTrans.Ptr(); });
		t = (_struct = Now().UTC(), new Time.Ptr(_struct.sec, _struct.nsec, _struct.loc));
		year = t.Year();
		txi = 0;
		y = year - 100 >> 0;
		while (y < (year + 100 >> 0)) {
			tx = (_slice$4 = l.tx, _index$4 = txi, (_index$4 >= 0 && _index$4 < _slice$4.length) ? _slice$4.array[_slice$4.offset + _index$4] : go$throwRuntimeError("index out of range"));
			tx.when = (x$6 = pseudoUnix(y, d0), x$7 = new Go$Int64(0, (_slice$5 = l.zone, _index$5 = i1, (_index$5 >= 0 && _index$5 < _slice$5.length) ? _slice$5.array[_slice$5.offset + _index$5] : go$throwRuntimeError("index out of range")).offset), new Go$Int64(x$6.high - x$7.high, x$6.low - x$7.low));
			tx.index = (i0 << 24 >>> 24);
			txi = txi + 1 >> 0;
			tx = (_slice$6 = l.tx, _index$6 = txi, (_index$6 >= 0 && _index$6 < _slice$6.length) ? _slice$6.array[_slice$6.offset + _index$6] : go$throwRuntimeError("index out of range"));
			tx.when = (x$8 = pseudoUnix(y, d1), x$9 = new Go$Int64(0, (_slice$7 = l.zone, _index$7 = i0, (_index$7 >= 0 && _index$7 < _slice$7.length) ? _slice$7.array[_slice$7.offset + _index$7] : go$throwRuntimeError("index out of range")).offset), new Go$Int64(x$8.high - x$9.high, x$8.low - x$9.low));
			tx.index = (i1 << 24 >>> 24);
			txi = txi + 1 >> 0;
			y = y + 1 >> 0;
		}
	};
	var initTestingZone = function() {
		initLocalFromTZI(usPacific);
	};
	var initAusTestingZone = function() {
		initLocalFromTZI(aus);
	};
	var initLocal = function() {
		var i, err, _tuple;
		i = new syscall.Timezoneinformation.Ptr();
		if (_tuple = syscall.GetTimeZoneInformation(i), err = _tuple[1], !(go$interfaceIsEqual(err, null))) {
			localLoc.name = "UTC";
			return;
		}
		initLocalFromTZI(i);
	};
	var loadLocation = function(name) {
		var err, _tuple, z;
		if (_tuple = loadZoneFile(runtime.GOROOT() + "\\lib\\time\\zoneinfo.zip", name), z = _tuple[0], err = _tuple[1], go$interfaceIsEqual(err, null)) {
			z.name = name;
			return [z, null];
		}
		return [(go$ptrType(Location)).nil, errors.New("unknown time zone " + name)];
	};
	var forceZipFileForTesting = function(zipOnly) {
	};
	go$pkg.init = function() {
		localLoc = new Location.Ptr();
		localOnce = new sync.Once.Ptr();
		var _map, _key, _tuple, _map$1, _key$1;
		std0x = go$toNativeArray("Int", [260, 265, 524, 526, 528, 274]);
		longDayNames = new (go$sliceType(Go$String))(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
		shortDayNames = new (go$sliceType(Go$String))(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
		shortMonthNames = new (go$sliceType(Go$String))(["---", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
		longMonthNames = new (go$sliceType(Go$String))(["---", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]);
		atoiError = errors.New("time: invalid number");
		errBad = errors.New("bad value for field");
		errLeadingInt = errors.New("time: bad [0-9]*");
		unitMap = (_map = new Go$Map(), _key = "ns", _map[_key] = { k: _key, v: 1 }, _key = "us", _map[_key] = { k: _key, v: 1000 }, _key = "\xC2\xB5s", _map[_key] = { k: _key, v: 1000 }, _key = "\xCE\xBCs", _map[_key] = { k: _key, v: 1000 }, _key = "ms", _map[_key] = { k: _key, v: 1e+06 }, _key = "s", _map[_key] = { k: _key, v: 1e+09 }, _key = "m", _map[_key] = { k: _key, v: 6e+10 }, _key = "h", _map[_key] = { k: _key, v: 3.6e+12 }, _map);
		months = go$toNativeArray("String", ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]);
		days = go$toNativeArray("String", ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
		daysBefore = go$toNativeArray("Int32", [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365]);
		utcLoc = new Location.Ptr("UTC", (go$sliceType(zone)).nil, (go$sliceType(zoneTrans)).nil, new Go$Int64(0, 0), new Go$Int64(0, 0), (go$ptrType(zone)).nil);
		go$pkg.UTC = utcLoc;
		go$pkg.Local = localLoc;
		_tuple = syscall.Getenv("ZONEINFO"), zoneinfo = _tuple[0];
		abbrs = (_map$1 = new Go$Map(), _key$1 = "Egypt Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EET", "EET") }, _key$1 = "Morocco Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("WET", "WEST") }, _key$1 = "South Africa Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("SAST", "SAST") }, _key$1 = "W. Central Africa Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("WAT", "WAT") }, _key$1 = "E. Africa Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EAT", "EAT") }, _key$1 = "Namibia Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("WAT", "WAST") }, _key$1 = "Alaskan Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("AKST", "AKDT") }, _key$1 = "Paraguay Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("PYT", "PYST") }, _key$1 = "Bahia Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("BRT", "BRST") }, _key$1 = "SA Pacific Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("COT", "COT") }, _key$1 = "Argentina Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("ART", "ART") }, _key$1 = "Venezuela Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("VET", "VET") }, _key$1 = "SA Eastern Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("GFT", "GFT") }, _key$1 = "Central Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CST", "CDT") }, _key$1 = "Mountain Standard Time (Mexico)", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("MST", "MDT") }, _key$1 = "Central Brazilian Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("AMT", "AMST") }, _key$1 = "Mountain Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("MST", "MDT") }, _key$1 = "Greenland Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("WGT", "WGST") }, _key$1 = "Central America Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CST", "CST") }, _key$1 = "Atlantic Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("AST", "ADT") }, _key$1 = "US Eastern Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EST", "EDT") }, _key$1 = "SA Western Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("BOT", "BOT") }, _key$1 = "Pacific Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("PST", "PDT") }, _key$1 = "Central Standard Time (Mexico)", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CST", "CDT") }, _key$1 = "Montevideo Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("UYT", "UYST") }, _key$1 = "Eastern Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EST", "EDT") }, _key$1 = "US Mountain Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("MST", "MST") }, _key$1 = "Canada Central Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CST", "CST") }, _key$1 = "Pacific Standard Time (Mexico)", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("PST", "PDT") }, _key$1 = "Pacific SA Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CLT", "CLST") }, _key$1 = "E. South America Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("BRT", "BRST") }, _key$1 = "Newfoundland Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("NST", "NDT") }, _key$1 = "Central Asia Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("ALMT", "ALMT") }, _key$1 = "Jordan Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EET", "EEST") }, _key$1 = "Arabic Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("AST", "AST") }, _key$1 = "Azerbaijan Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("AZT", "AZST") }, _key$1 = "SE Asia Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("ICT", "ICT") }, _key$1 = "Middle East Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EET", "EEST") }, _key$1 = "India Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("IST", "IST") }, _key$1 = "Sri Lanka Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("IST", "IST") }, _key$1 = "Syria Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EET", "EEST") }, _key$1 = "Bangladesh Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("BDT", "BDT") }, _key$1 = "Arabian Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("GST", "GST") }, _key$1 = "North Asia East Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("IRKT", "IRKT") }, _key$1 = "Israel Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("IST", "IDT") }, _key$1 = "Afghanistan Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("AFT", "AFT") }, _key$1 = "Pakistan Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("PKT", "PKT") }, _key$1 = "Nepal Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("NPT", "NPT") }, _key$1 = "North Asia Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("KRAT", "KRAT") }, _key$1 = "Magadan Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("MAGT", "MAGT") }, _key$1 = "E. Europe Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EET", "EEST") }, _key$1 = "N. Central Asia Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("NOVT", "NOVT") }, _key$1 = "Myanmar Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("MMT", "MMT") }, _key$1 = "Arab Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("AST", "AST") }, _key$1 = "Korea Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("KST", "KST") }, _key$1 = "China Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CST", "CST") }, _key$1 = "Singapore Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("SGT", "SGT") }, _key$1 = "Taipei Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CST", "CST") }, _key$1 = "West Asia Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("UZT", "UZT") }, _key$1 = "Georgian Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("GET", "GET") }, _key$1 = "Iran Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("IRST", "IRDT") }, _key$1 = "Tokyo Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("JST", "JST") }, _key$1 = "Ulaanbaatar Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("ULAT", "ULAT") }, _key$1 = "Vladivostok Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("VLAT", "VLAT") }, _key$1 = "Yakutsk Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("YAKT", "YAKT") }, _key$1 = "Ekaterinburg Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("YEKT", "YEKT") }, _key$1 = "Caucasus Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("AMT", "AMT") }, _key$1 = "Azores Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("AZOT", "AZOST") }, _key$1 = "Cape Verde Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CVT", "CVT") }, _key$1 = "Greenwich Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("GMT", "GMT") }, _key$1 = "Cen. Australia Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CST", "CST") }, _key$1 = "E. Australia Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EST", "EST") }, _key$1 = "AUS Central Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CST", "CST") }, _key$1 = "Tasmania Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EST", "EST") }, _key$1 = "W. Australia Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("WST", "WST") }, _key$1 = "AUS Eastern Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EST", "EST") }, _key$1 = "UTC", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("GMT", "GMT") }, _key$1 = "UTC-11", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("GMT+11", "GMT+11") }, _key$1 = "Dateline Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("GMT+12", "GMT+12") }, _key$1 = "UTC-02", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("GMT+2", "GMT+2") }, _key$1 = "UTC+12", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("GMT-12", "GMT-12") }, _key$1 = "W. Europe Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CET", "CEST") }, _key$1 = "GTB Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EET", "EEST") }, _key$1 = "Central Europe Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CET", "CEST") }, _key$1 = "Turkey Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EET", "EEST") }, _key$1 = "Kaliningrad Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("FET", "FET") }, _key$1 = "FLE Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("EET", "EEST") }, _key$1 = "GMT Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("GMT", "BST") }, _key$1 = "Russian Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("MSK", "MSK") }, _key$1 = "Romance Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CET", "CEST") }, _key$1 = "Central European Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("CET", "CEST") }, _key$1 = "Mauritius Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("MUT", "MUT") }, _key$1 = "Samoa Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("WST", "WST") }, _key$1 = "New Zealand Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("NZST", "NZDT") }, _key$1 = "Fiji Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("FJT", "FJT") }, _key$1 = "Central Pacific Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("SBT", "SBT") }, _key$1 = "Hawaiian Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("HST", "HST") }, _key$1 = "West Pacific Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("PGT", "PGT") }, _key$1 = "Tonga Standard Time", _map$1[_key$1] = { k: _key$1, v: new abbr.Ptr("TOT", "TOT") }, _map$1);
		badData = errors.New("malformed time zone information");
		usPacific = new syscall.Timezoneinformation.Ptr(480, go$toNativeArray("Uint16", [80, 97, 99, 105, 102, 105, 99, 32, 83, 116, 97, 110, 100, 97, 114, 100, 32, 84, 105, 109, 101, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), new syscall.Systemtime.Ptr(0, 11, 0, 1, 2, 0, 0, 0), 0, go$toNativeArray("Uint16", [80, 97, 99, 105, 102, 105, 99, 32, 68, 97, 121, 108, 105, 103, 104, 116, 32, 84, 105, 109, 101, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), new syscall.Systemtime.Ptr(0, 3, 0, 2, 2, 0, 0, 0), -60);
		aus = new syscall.Timezoneinformation.Ptr(-600, go$toNativeArray("Uint16", [65, 85, 83, 32, 69, 97, 115, 116, 101, 114, 110, 32, 83, 116, 97, 110, 100, 97, 114, 100, 32, 84, 105, 109, 101, 0, 0, 0, 0, 0, 0, 0]), new syscall.Systemtime.Ptr(0, 4, 0, 1, 3, 0, 0, 0), 0, go$toNativeArray("Uint16", [65, 85, 83, 32, 69, 97, 115, 116, 101, 114, 110, 32, 68, 97, 121, 108, 105, 103, 104, 116, 32, 84, 105, 109, 101, 0, 0, 0, 0, 0, 0, 0]), new syscall.Systemtime.Ptr(0, 10, 0, 1, 2, 0, 0, 0), -60);
	};
	return go$pkg;
})();
go$packages["main"] = (function() {
	var go$pkg = {};
	var js = go$packages["github.com/gopherjs/gopherjs/js"];
	var jquery = go$packages["github.com/rusco/jquery"];
	var qunit = go$packages["github.com/rusco/qunit"];
	var strconv = go$packages["strconv"];
	var time = go$packages["time"];
	var jQuery;
	var getDocumentBody = function() {
		return go$global.document.body;
	};
	var getWindow = function() {
		return go$global.window;
	};
	var getGlobalVariable = function(variable) {
		return go$global.window[go$externalize(variable, Go$String)];
	};
	var main = go$pkg.main = function() {
		qunit.Module("core");
		qunit.Test("jQuery Properties", (function(assert) {
			var _struct, jQ2;
			assert.Equal(new Go$String(go$internalize(jQuery(new (go$sliceType(go$emptyInterface))([])).o.jquery, Go$String)), new Go$String("2.1.0"), "JQuery Version");
			assert.Equal(new Go$String(go$internalize(jQuery(new (go$sliceType(go$emptyInterface))([])).o.length, Go$String)), new Go$Int(0), "jQuery().Length");
			jQ2 = (_struct = jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("body")])), new jquery.JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
			assert.Equal(new Go$String(go$internalize(jQ2.o.selector, Go$String)), new Go$String("body"), "jQ2 := jQuery(\"body\"); jQ2.Selector.Selector");
			assert.Equal(new Go$String(go$internalize(jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("body")])).o.selector, Go$String)), new Go$String("body"), "jQuery(\"body\").Selector");
		}));
		qunit.Test("Test Setup", (function(assert) {
			var _struct, test;
			test = (_struct = jQuery(new (go$sliceType(go$emptyInterface))([getDocumentBody()])).Find("#qunit-fixture"), new jquery.JQuery.Ptr(_struct.o, _struct.Jquery, _struct.Selector, _struct.Length, _struct.Context));
			assert.Equal(new Go$String(go$internalize(test.o.selector, Go$String)), new Go$String("#qunit-fixture"), "#qunit-fixture find Selector");
			assert.Equal(new Go$String(go$internalize(test.o.context, Go$String)), getDocumentBody(), "#qunit-fixture find Context");
		}));
		qunit.Test("Static Functions", (function(assert) {
			var x, _map, _key, o;
			jquery.GlobalEval("var globalEvalTest = 2;");
			assert.Equal(new Go$Int((go$parseInt(getGlobalVariable("globalEvalTest")) >> 0)), new Go$Int(2), "GlobalEval: Test variable declarations are global");
			assert.Equal(new Go$String(jquery.Trim("  GopherJS  ")), new Go$String("GopherJS"), "Trim: leading and trailing space");
			assert.Equal(new Go$String(jquery.Type(new Go$Bool(true))), new Go$String("boolean"), "Type: Boolean");
			assert.Equal(new Go$String(jquery.Type((x = time.Now(), new x.constructor.Struct(x)))), new Go$String("date"), "Type: Date");
			assert.Equal(new Go$String(jquery.Type(new Go$String("GopherJS"))), new Go$String("string"), "Type: String");
			assert.Equal(new Go$String(jquery.Type(new Go$Float64(12.21))), new Go$String("number"), "Type: Number");
			assert.Equal(new Go$String(jquery.Type(null)), new Go$String("null"), "Type: Null");
			assert.Equal(new Go$String(jquery.Type(new (go$arrayType(Go$String, 2))(go$toNativeArray("String", ["go", "lang"])))), new Go$String("array"), "Type: Array");
			assert.Equal(new Go$String(jquery.Type(new (go$sliceType(Go$String))(["go", "lang"]))), new Go$String("array"), "Type: Array");
			o = (_map = new Go$Map(), _key = "a", _map[_key] = { k: _key, v: new Go$Bool(true) }, _key = "b", _map[_key] = { k: _key, v: new Go$Float64(1.1) }, _key = "c", _map[_key] = { k: _key, v: new Go$String("more") }, _map);
			assert.Equal(new Go$String(jquery.Type(new (go$mapType(Go$String, go$emptyInterface))(o))), new Go$String("object"), "Type: Object");
			assert.Equal(new Go$String(jquery.Type(new (go$funcType([], [js.Object], false))(getDocumentBody))), new Go$String("function"), "Type: Function");
			assert.Ok(new Go$Bool(!jquery.IsPlainObject(new Go$String(""))), "IsPlainObject: string");
			assert.Ok(new Go$Bool(jquery.IsPlainObject(new (go$mapType(Go$String, go$emptyInterface))(o))), "IsPlainObject: Object");
			assert.Ok(new Go$Bool(!jquery.IsFunction(new Go$String(""))), "IsFunction: string");
			assert.Ok(new Go$Bool(jquery.IsFunction(new (go$funcType([], [js.Object], false))(getDocumentBody))), "IsFunction: getDocumentBody");
			assert.Ok(new Go$Bool(!jquery.IsNumeric(new Go$String("a3a"))), "IsNumeric: string");
			assert.Ok(new Go$Bool(jquery.IsNumeric(new Go$String("0xFFF"))), "IsNumeric: hex");
			assert.Ok(new Go$Bool(jquery.IsNumeric(new Go$String("8e-2"))), "IsNumeric: exponential");
			assert.Ok(new Go$Bool(!jquery.IsXMLDoc(new (go$funcType([], [js.Object], false))(getDocumentBody))), "HTML Body element");
			assert.Ok(new Go$Bool(jquery.IsWindow(getWindow())), "window");
		}));
		qunit.Module("dom");
		qunit.Test("AddClass,Clone,Add,AppenTo,Find", (function(assert) {
			var txt;
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("p")])).AddClass("wow").Clone().Add("<span id='dom02'>WhatADay</span>").AppendTo("#qunit-fixture");
			txt = jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).Find("span#dom02").Text();
			assert.Equal(new Go$String(txt), new Go$String("WhatADay"), "Test of Clone, Add, AppendTo, Find, Text Functions");
		}));
		qunit.Test("ApiOnly:ScollFn,SetCss,FadeOut", (function(assert) {
			var i;
			qunit.Expect(0);
			i = 0;
			while (i < 3) {
				jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("p")])).Clone().AppendTo("#qunit-fixture");
				i = i + 1 >> 0;
			}
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("#qunit-fixture")])).ScrollFn((function() {
				jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("span")])).SetCss(new Go$String("display"), new Go$String("inline")).FadeOut("slow");
			}));
		}));
		qunit.Test("ApiOnly:SelectFn,SetText,Show,FadeOut", (function(assert) {
			qunit.Expect(0);
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("\n\t\t\t<p>Click and drag the mouse to select text in the inputs.</p>\n  \t\t\t<input type=\"text\" value=\"Some text\">\n  \t\t\t<input type=\"text\" value=\"to test on\">\n  \t\t\t<div></div>")])).AppendTo("#qunit-fixture");
			jQuery(new (go$sliceType(go$emptyInterface))([new Go$String(":input")])).SelectFn((function() {
				jQuery(new (go$sliceType(go$emptyInterface))([new Go$String("div")])).SetText("Something was selected").Show().FadeOut("1000");
			}));
		}));
	};
	go$pkg.init = function() {
		jQuery = jquery.NewJQuery;
	};
	return go$pkg;
})();
go$error.implementedBy = [go$packages["errors"].errorString.Ptr, go$packages["github.com/gopherjs/gopherjs/js"].Error.Ptr, go$packages["runtime"].TypeAssertionError.Ptr, go$packages["runtime"].errorCString, go$packages["runtime"].errorString, go$packages["strconv"].NumError.Ptr, go$packages["syscall"].DLLError.Ptr, go$packages["syscall"].Errno, go$packages["time"].ParseError.Ptr, go$ptrType(go$packages["runtime"].errorCString), go$ptrType(go$packages["runtime"].errorString), go$ptrType(go$packages["syscall"].Errno)];
go$packages["runtime"].Error.implementedBy = [go$packages["runtime"].TypeAssertionError.Ptr, go$packages["runtime"].errorCString, go$packages["runtime"].errorString, go$ptrType(go$packages["runtime"].errorCString), go$ptrType(go$packages["runtime"].errorString)];
go$packages["runtime"].stringer.implementedBy = [go$packages["github.com/gopherjs/gopherjs/js"].Error, go$packages["github.com/gopherjs/gopherjs/js"].Error.Ptr, go$packages["github.com/rusco/jquery"].Event, go$packages["github.com/rusco/jquery"].Event.Ptr, go$packages["github.com/rusco/qunit"].DoneCallbackObject, go$packages["github.com/rusco/qunit"].DoneCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].LogCallbackObject, go$packages["github.com/rusco/qunit"].LogCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].ModuleDoneCallbackObject, go$packages["github.com/rusco/qunit"].ModuleDoneCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].ModuleStartCallbackObject, go$packages["github.com/rusco/qunit"].ModuleStartCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].QUnitAssert, go$packages["github.com/rusco/qunit"].QUnitAssert.Ptr, go$packages["github.com/rusco/qunit"].Raises, go$packages["github.com/rusco/qunit"].Raises.Ptr, go$packages["github.com/rusco/qunit"].TestDoneCallbackObject, go$packages["github.com/rusco/qunit"].TestDoneCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].TestStartCallbackObject, go$packages["github.com/rusco/qunit"].TestStartCallbackObject.Ptr, go$packages["strconv"].decimal.Ptr, go$packages["syscall"].Signal, go$packages["time"].Duration, go$packages["time"].Location.Ptr, go$packages["time"].Month, go$packages["time"].Time, go$packages["time"].Time.Ptr, go$packages["time"].Weekday, go$ptrType(go$packages["syscall"].Signal), go$ptrType(go$packages["time"].Duration), go$ptrType(go$packages["time"].Month), go$ptrType(go$packages["time"].Weekday)];
go$packages["github.com/gopherjs/gopherjs/js"].Object.implementedBy = [go$packages["github.com/gopherjs/gopherjs/js"].Error, go$packages["github.com/gopherjs/gopherjs/js"].Error.Ptr, go$packages["github.com/rusco/jquery"].Event, go$packages["github.com/rusco/jquery"].Event.Ptr, go$packages["github.com/rusco/qunit"].DoneCallbackObject, go$packages["github.com/rusco/qunit"].DoneCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].LogCallbackObject, go$packages["github.com/rusco/qunit"].LogCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].ModuleDoneCallbackObject, go$packages["github.com/rusco/qunit"].ModuleDoneCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].ModuleStartCallbackObject, go$packages["github.com/rusco/qunit"].ModuleStartCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].QUnitAssert, go$packages["github.com/rusco/qunit"].QUnitAssert.Ptr, go$packages["github.com/rusco/qunit"].Raises, go$packages["github.com/rusco/qunit"].Raises.Ptr, go$packages["github.com/rusco/qunit"].TestDoneCallbackObject, go$packages["github.com/rusco/qunit"].TestDoneCallbackObject.Ptr, go$packages["github.com/rusco/qunit"].TestStartCallbackObject, go$packages["github.com/rusco/qunit"].TestStartCallbackObject.Ptr];
go$packages["sync"].Locker.implementedBy = [go$packages["sync"].Mutex.Ptr, go$packages["sync"].RWMutex.Ptr, go$packages["sync"].rlocker.Ptr];
go$packages["syscall"].Sockaddr.implementedBy = [go$packages["syscall"].SockaddrInet4.Ptr, go$packages["syscall"].SockaddrInet6.Ptr, go$packages["syscall"].SockaddrUnix.Ptr];
go$packages["runtime"].init();
go$packages["github.com/gopherjs/gopherjs/js"].init();
go$packages["github.com/rusco/jquery"].init();
go$packages["github.com/rusco/qunit"].init();
go$packages["errors"].init();
go$packages["math"].init();
go$packages["unicode/utf8"].init();
go$packages["strconv"].init();
go$packages["sync/atomic"].init();
go$packages["sync"].init();
go$packages["unicode/utf16"].init();
go$packages["syscall"].init();
go$packages["time"].init();
go$packages["main"].init();
go$packages["main"].main();

// QuickJS payload digestion benchmarks
// Called from C host with raw JSON strings, returns parsed/validated results

function parse_json(raw) {
    return JSON.parse(raw);
}

function extract_fields(raw) {
    const obj = JSON.parse(raw);
    // Extract nested fields — simulates consuming an API response
    return {
        id: obj.id,
        name: obj.user ? obj.user.name : null,
        city: obj.user && obj.user.address ? obj.user.address.city : null,
        item_count: obj.items ? obj.items.length : 0,
        total: obj.metadata ? obj.metadata.total : 0,
    };
}

function validate_schema(raw) {
    const obj = JSON.parse(raw);
    // Validate expected shape
    if (typeof obj !== "object" || obj === null) return false;
    if (typeof obj.id !== "number") return false;
    if (typeof obj.user !== "object") return false;
    if (typeof obj.user.name !== "string") return false;
    if (typeof obj.user.email !== "string") return false;
    if (!Array.isArray(obj.items)) return false;
    for (let i = 0; i < obj.items.length; i++) {
        const item = obj.items[i];
        if (typeof item.id !== "number") return false;
        if (typeof item.name !== "string") return false;
        if (typeof item.price !== "number") return false;
    }
    return true;
}

// Bridge test: parse JSON and return a specific scalar result
// This simulates the "parse in JS, return result to Zig" pattern
function parse_and_return_total(raw) {
    const obj = JSON.parse(raw);
    let total = 0;
    if (obj.items) {
        for (let i = 0; i < obj.items.length; i++) {
            total += obj.items[i].price;
        }
    }
    return total;
}

// Bridge test: parse JSON and return serialized extracted data
// This simulates "parse in JS, serialize result back for Zig consumption"
function parse_extract_serialize(raw) {
    const obj = JSON.parse(raw);
    const result = {
        user_name: obj.user ? obj.user.name : "",
        item_count: obj.items ? obj.items.length : 0,
        total_price: 0,
    };
    if (obj.items) {
        for (let i = 0; i < obj.items.length; i++) {
            result.total_price += obj.items[i].price;
        }
    }
    return JSON.stringify(result);
}

globalThis.parse_json = parse_json;
globalThis.extract_fields = extract_fields;
globalThis.validate_schema = validate_schema;
globalThis.parse_and_return_total = parse_and_return_total;
globalThis.parse_extract_serialize = parse_extract_serialize;

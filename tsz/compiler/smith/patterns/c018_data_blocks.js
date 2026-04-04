// ── Chad Pattern c018: Named data blocks ────────────────────────
// Group: data
// Status: stub
//
// Chad syntax:
//   // Simple array:
//   <var>
//     colors is array
//   </var>
//   <colors>
//     red
//     green
//     blue
//   </colors>
//
//   // Typed array:
//   <var>
//     pages is page array
//   </var>
//   <pages>
//     home
//     settings
//     profile
//   </pages>
//
//   // Object array:
//   <var>
//     cards is objects
//   </var>
//   <cards>
//     id: 1, title: Auth flow, col: todo
//     id: 2, title: Write tests, col: todo
//   </cards>
//
//   // Object:
//   <var>
//     config is object
//   </var>
//   <config>
//     name exact 'app'
//     version is 1
//   </config>
//
// Soup equivalent:
//   const colors = ['red', 'green', 'blue'];
//   const cards = [{ id: 1, title: 'Auth flow', col: 'todo' }, ...];
//
// Zig output target:
//   OA registrations: ctx.objectArrays with fields, constData.
//   Simple arrays: isSimpleArray OA with _v field.
//   Objects: key-value const data.
//
// Current owner: lanes/chad.js (data block parsing loop)
//
// Notes:
//   Block name matches var name. One item per line for arrays.
//   Objects: comma-separated key: value pairs per line.
//   Field types inferred from first row (string/int/float/boolean).

function match(c, ctx) {
  return false;
}

function compile(c, ctx) {
  return null;
}

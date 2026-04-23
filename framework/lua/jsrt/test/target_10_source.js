function add(a, b) { return a + b }
[1, 2, 3, 4].reduce((acc, x) => add(acc, x), 0)

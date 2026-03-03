import React from 'react';
import { Box, Text, CodeBlock } from '../../../packages/core/src';

const CODE_LUA = `local function fibonacci(n)
  if n <= 1 then return n end
  local a, b = 0, 1
  for i = 2, n do
    a, b = b, a + b
  end
  return b
end

for i = 0, 20 do
  print(string.format("fib(%d) = %d", i, fibonacci(i)))
end`;

const CODE_C = `#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    int value;
    struct Node *next;
} Node;

Node *push(Node *head, int val) {
    Node *n = malloc(sizeof(Node));
    n->value = val;
    n->next = head;
    return n;
}

int main(void) {
    Node *list = NULL;
    for (int i = 0; i < 10; i++)
        list = push(list, i * i);
    return 0;
}`;

const CODE_PYTHON = `import asyncio
from dataclasses import dataclass

@dataclass
class Task:
    name: str
    priority: int = 0

async def worker(queue: asyncio.Queue):
    while True:
        task = await queue.get()
        print(f"Processing {task.name} (pri={task.priority})")
        await asyncio.sleep(0.1)
        queue.task_done()

async def main():
    queue = asyncio.Queue()
    for name in ["alpha", "bravo", "charlie"]:
        await queue.put(Task(name=name))
    worker_task = asyncio.create_task(worker(queue))
    await queue.join()
    worker_task.cancel()`;

const CODE_TS = `<Aaa
  bbb={{ ccc: 'ddd', eee: 'fff', ggg: 'hhh', backgroundColor: '#1e1e2e', justifyContent: 'center', alignItems: 'center' }}
  cccc={{ ddd: 'eeeeee', ff: 'gg', hhhh: 'aaa', borderColor: '#45475a', borderWidth: 2, borderRadius: 12 }}
  fffff={{ gg: 'hhhhhhh', aaa: 'bb', ccc: 'dddd', transform: [{ scale: 0.98 }], opacity: 0.9 }}
  onClick={(eee) => { console.log('aaa', eee.bbb, eee.ccc); ddddd(eee); }}
  onPointerEnter={(ff) => { ggggg(true); hhhhh('aaaa'); bbbbb.ccccc('ddd', { eee: 'FFF', ggg: 'hhh' }); }}
  onPointerLeave={(aaa) => { bbbbb(false); ccccc(); ddddd(); eeeee(); fffff(); }}
  onKeyDown={(ggg) => { if (ggg.hhh === 'Enter') aaaa(); else if (ggg.bbb === 'Escape') cccc(); else dddd(ggg); }}
>
  {children}
</Aaa>`;

export function Layout1Story() {
  return (
    <Box style={{ width: '100%', height: '100%', padding: 12, gap: 8 }}>
      <Box style={{ flexDirection: 'row', gap: 8, flexGrow: 1 }}>
        <Box style={{ flexGrow: 1, gap: 4 }}>
          <Text style={{ color: '#888', fontSize: 11 }}>{`language="lua"`}</Text>
          <CodeBlock code={CODE_LUA} language="lua" fontSize={9} style={{ flexGrow: 1 }} />
        </Box>
        <Box style={{ flexGrow: 1, gap: 4 }}>
          <Text style={{ color: '#888', fontSize: 11 }}>{`language="c"`}</Text>
          <CodeBlock code={CODE_C} language="c" fontSize={9} style={{ flexGrow: 1 }} />
        </Box>
      </Box>
      <Box style={{ flexDirection: 'row', gap: 8, flexGrow: 1 }}>
        <Box style={{ flexGrow: 1, gap: 4 }}>
          <Text style={{ color: '#888', fontSize: 11 }}>{`language="python"`}</Text>
          <CodeBlock code={CODE_PYTHON} language="python" fontSize={9} style={{ flexGrow: 1 }} />
        </Box>
        <Box style={{ flexGrow: 1, gap: 4 }}>
          <Text style={{ color: '#888', fontSize: 11 }}>{`language="typescript" (original)`}</Text>
          <CodeBlock code={CODE_TS} language="typescript" fontSize={9} style={{ flexGrow: 1 }} />
        </Box>
      </Box>
    </Box>
  );
}

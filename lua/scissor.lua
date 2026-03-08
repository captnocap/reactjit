local Scissor = {}

function Scissor.intersectRect(x, y, w, h)
  local sx, sy = love.graphics.transformPoint(x, y)
  local sx2, sy2 = love.graphics.transformPoint(x + w, y + h)
  local sw = math.max(0, sx2 - sx)
  local sh = math.max(0, sy2 - sy)
  love.graphics.intersectScissor(sx, sy, sw, sh)
end

function Scissor.saveIntersected(x, y, w, h)
  local prevScissor = { love.graphics.getScissor() }
  Scissor.intersectRect(x, y, w, h)
  return prevScissor
end

function Scissor.restore(prevScissor)
  if prevScissor and prevScissor[1] then
    love.graphics.setScissor(prevScissor[1], prevScissor[2], prevScissor[3], prevScissor[4])
  else
    love.graphics.setScissor()
  end
end

return Scissor

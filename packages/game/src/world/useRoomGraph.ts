import { useState, useRef, useCallback } from 'react';
import type { RoomDef } from '../types';

export interface RoomGraphState {
  /** All rooms */
  rooms: RoomDef[];
  /** Current room ID */
  currentRoom: string | null;
  /** Get a room by ID */
  getRoom: (id: string) => RoomDef | undefined;
  /** Get rooms connected to a given room */
  getAdjacentRooms: (id: string) => RoomDef[];
  /** Move to a connected room */
  moveToRoom: (id: string) => boolean;
  /** Add a room */
  addRoom: (room: RoomDef) => void;
  /** Connect two rooms */
  connect: (roomA: string, roomB: string) => void;
  /** Set current room without checking adjacency */
  setCurrentRoom: (id: string) => void;
}

export function useRoomGraph(initialRooms?: RoomDef[]): RoomGraphState {
  const [, forceRender] = useState(0);
  const roomsRef = useRef<Map<string, RoomDef>>(new Map());
  const currentRef = useRef<string | null>(null);

  // Initialize rooms
  if (initialRooms && roomsRef.current.size === 0) {
    for (const room of initialRooms) {
      roomsRef.current.set(room.id, room);
    }
    if (initialRooms.length > 0) {
      currentRef.current = initialRooms[0].id;
    }
  }

  const getRoom = useCallback((id: string) => roomsRef.current.get(id), []);

  const getAdjacentRooms = useCallback((id: string): RoomDef[] => {
    const room = roomsRef.current.get(id);
    if (!room) return [];
    return room.connections
      .map(cid => roomsRef.current.get(cid))
      .filter(Boolean) as RoomDef[];
  }, []);

  const moveToRoom = useCallback((id: string): boolean => {
    if (!currentRef.current) return false;
    const current = roomsRef.current.get(currentRef.current);
    if (!current || !current.connections.includes(id)) return false;
    if (!roomsRef.current.has(id)) return false;
    currentRef.current = id;
    forceRender(n => n + 1);
    return true;
  }, []);

  const addRoom = useCallback((room: RoomDef) => {
    roomsRef.current.set(room.id, room);
    if (currentRef.current === null) currentRef.current = room.id;
    forceRender(n => n + 1);
  }, []);

  const connect = useCallback((roomA: string, roomB: string) => {
    const a = roomsRef.current.get(roomA);
    const b = roomsRef.current.get(roomB);
    if (a && !a.connections.includes(roomB)) a.connections.push(roomB);
    if (b && !b.connections.includes(roomA)) b.connections.push(roomA);
    forceRender(n => n + 1);
  }, []);

  const setCurrentRoom = useCallback((id: string) => {
    if (roomsRef.current.has(id)) {
      currentRef.current = id;
      forceRender(n => n + 1);
    }
  }, []);

  return {
    rooms: Array.from(roomsRef.current.values()),
    currentRoom: currentRef.current,
    getRoom,
    getAdjacentRooms,
    moveToRoom,
    addRoom,
    connect,
    setCurrentRoom,
  };
}

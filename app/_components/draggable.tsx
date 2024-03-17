import { Matrix } from "ml-matrix";
import {
  Dispatch,
  LegacyRef,
  ReactNode,
  SetStateAction,
  MouseEvent,
  useState,
  useEffect,
  useCallback
} from "react";

import { transformPoint, translate } from "@/_lib/geometry";
import { mouseToCanvasPoint, Point, touchToCanvasPoint, nativeMouseToCanvasPoint} from "@/_lib/point";

export default function Draggable({
  children,
  className,
  viewportClassName,
  localTransform,
  setLocalTransform,
  perspective,
}: {
  children: ReactNode;
  className: string | undefined;
  viewportClassName: string | undefined;
  localTransform: Matrix;
  setLocalTransform: Dispatch<SetStateAction<Matrix>>;
  perspective: Matrix;
}) {
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [currentMousePos, setCurrentMousePos] = useState<Point | null>(null);
  const [transformStart, setTransformStart] = useState<Matrix | null>(null);
  const [isAxisLocked, setIsAxisLocked] = useState<Boolean>(false);

  const AXIS_LOCK_KEYBIND = 'Shift';

  const handleKeyDown = useCallback(
    function (e: React.KeyboardEvent) {
      if (e.key === AXIS_LOCK_KEYBIND) {
        e.preventDefault();
        setIsAxisLocked(true);
      } 
    },
    [
      setIsAxisLocked,
    ],
  );

  const handleKeyUp = useCallback(
    function (e: React.KeyboardEvent) {
      if (e.key === AXIS_LOCK_KEYBIND) {
        e.preventDefault();
        setIsAxisLocked(false);
      } 
    },
    [
      setIsAxisLocked,
    ],
  );

  /* This effect causes the position of the div to update instantly if
   isAxisLocked changes, rather than needing the mouse to move first */
  useEffect(() => {
    if (dragStart !==null && isAxisLocked && currentMousePos !== null) {
      handleMove(currentMousePos);
    }
  }, [dragStart, isAxisLocked, currentMousePos]);

  function handleOnEnd(): void {
    setDragStart(null);
    setTransformStart(null);
  }

  function handleOnMouseMove(e: MouseEvent<HTMLDivElement>): void {
    /* If we aren't currently dragging, ignore the mouse move event */
    if (dragStart === null) {
      return;
    }

    const newMousePos = mouseToCanvasPoint(e)
    setCurrentMousePos(newMousePos)

    if ((e.buttons & 1) === 0 && dragStart !== null) {
      handleOnEnd();
      return;
    }
    handleMove(newMousePos);
  }

  function toSingleAxisVector(vec: Point): Point{
    if (Math.abs(vec.x) > Math.abs(vec.y)){
      return {x: vec.x, y:0} 
    } else {
      return {x: 0, y:vec.y} 
    }
  }

  function handleMove(p: Point) {
    if (transformStart !== null && dragStart !== null) {
      const dest = transformPoint(p, perspective);
      const tx = dest.x - dragStart.x;
      const ty = dest.y - dragStart.y;
      let vec = {x: tx, y:ty};
      if (isAxisLocked){
        vec = toSingleAxisVector(vec);
      }
      const m = translate(vec);
      setLocalTransform(transformStart.mmul(m));
    }
  }

  function handleOnStart(p: Point): void {
    var pt = transformPoint(p, perspective);
    setDragStart(pt);
    setTransformStart(localTransform.clone());
  }

  //TODO: the react-pdf class endOfContent is overwriting this cursor style.
  //      we need to prevent this from happening somehow. 
  const cursorMode = `${dragStart !== null ? 'grabbing' : 'grab'}`;
  const viewportCursorMode = `${dragStart !== null ? 'grabbing': 'default'}`;

  return (
    <div
      tabIndex={0}
      className={viewportClassName + " w-screen h-screen "}
      onMouseMove={handleOnMouseMove}
      onMouseUp={handleOnEnd}
      onKeyUp={handleKeyUp}
      onKeyDown={handleKeyDown}
      style={{
        cursor:viewportCursorMode
      }}
    >
      <div
        className={className}
        onMouseDown={(e) => {handleOnStart(mouseToCanvasPoint(e))}}
        onTouchMove={(e) => handleMove(touchToCanvasPoint(e))}
        onTouchStart={(e) => handleOnStart(touchToCanvasPoint(e))}
        onTouchEnd={handleOnEnd}
        onMouseUp={handleOnEnd}
        style={{
          cursor:cursorMode
        }}
        // TODO: consider theses style={{ mixBlendMode: "hard-light" }}
      >
        {children}
      </div>
    </div>
  );
}

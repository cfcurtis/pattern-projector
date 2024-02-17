import Matrix from "ml-matrix";
import React, {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
} from "react";

import { interp, minIndex, sqrdist, transformPoints } from "@/_lib/geometry";
import { mouseToCanvasPoint, Point, touchToCanvasPoint } from "@/_lib/point";

/**
 * A window width and height canvas used for projector calibration
 * @param draw - Draws in the canvas rendering context
 */
export default function CalibrationCanvas({
  className,
  windowScreen,
  points,
  setPoints,
  pointToModify,
  setPointToModify,
  perspective,
  width,
  height,
}: {
  className: string | undefined;
  windowScreen: Point;
  points: Point[];
  setPoints: Dispatch<SetStateAction<Point[]>>;
  pointToModify: number | null;
  setPointToModify: Dispatch<SetStateAction<number | null>>;
  perspective: Matrix;
  width: number;
  height: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const maxPoints = 4; // One point per vertex in rectangle
  const radius = 30;

  function drawLine(ctx: CanvasRenderingContext2D, p1: Point, p2: Point): void {
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  useEffect(() => {
    if (canvasRef !== null && canvasRef.current !== null) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (ctx !== null) {
        ctx.canvas.width = window.innerWidth;
        ctx.canvas.height = window.innerHeight;

        function drawGrid(ctx: CanvasRenderingContext2D): void {
          for (let i = 1; i + 1 <= width; i++) {
            // TODO: fix needing dpi added in here.
            const line = transformPoints(
              [
                { x: i * 96, y: 0 },
                { x: i * 96, y: height * 96 },
              ],
              perspective
            );
            drawLine(ctx, line[0], line[1]);
          }
          for (let i = 1; i + 1 <= height; i++) {
            const line = transformPoints(
              [
                { x: 0, y: i * 96 },
                { x: width * 96, y: i * 96 },
              ],
              perspective
            );
            drawLine(ctx, line[0], line[1]);
          }
        }
        function draw(
          ctx: CanvasRenderingContext2D,
          windowScreen: Point,
          points: Point[]
        ): void {
          ctx.strokeStyle = "#ffffff";
          const dy = windowScreen.y + window.outerHeight - window.innerHeight;
          const dx = windowScreen.x + window.outerWidth - window.innerWidth;
          ctx.translate(-dx, -dy);

          let prev = points[0];
          let start = Math.PI / 2; // Adds 3/4 circle around nodes to show which corners they belong in
          for (let point of points) {
            drawLine(ctx, prev, point);

            ctx.beginPath();
            ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(
              point.x,
              point.y,
              radius + 5,
              start,
              start + Math.PI + Math.PI / 2
            );
            ctx.stroke();
            prev = point;
            start += Math.PI / 2;
          }

          if (points.length === maxPoints) {
            drawLine(ctx, points[0], prev);
          }

          drawGrid(ctx);
        }
        draw(ctx, windowScreen, points);
      }
    }
  }, [windowScreen, points, perspective, width, height]);

  function handleDown(newPoint: Point) {
    if (points.length < maxPoints) {
      setPoints([...points, newPoint]);
    } else {
      setPointToModify(minIndex(points.map((a) => sqrdist(a, newPoint))));
    }
  }

  function handleMove(p: Point, filter: number) {
    if (pointToModify !== null) {
      const newPoints = [...points];
      newPoints[pointToModify] = interp(newPoints[pointToModify], p, filter);
      setPoints(newPoints);
    }
  }

  function handleUp() {
    localStorage.setItem("points", JSON.stringify(points));
    setPointToModify(null);
  }

  return (
    <canvas
      ref={canvasRef}
      className={className}
      onMouseMove={(e: React.MouseEvent) => {
        if ((e.buttons & 1) == 0) {
          handleUp();
        } else {
          handleMove(mouseToCanvasPoint(e), 1);
        }
      }}
      onMouseDown={(e) => handleDown(mouseToCanvasPoint(e))}
      onMouseUp={() => handleUp()}
      onTouchStart={(e: React.TouchEvent) => handleDown(touchToCanvasPoint(e))}
      onTouchMove={(e: React.TouchEvent) =>
        handleMove(touchToCanvasPoint(e), 0.05)
      }
      onTouchEnd={() => handleUp()}
    />
  );
}

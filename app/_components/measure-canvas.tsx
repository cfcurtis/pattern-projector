import {
  angleDeg,
  constrainInSpace,
  sqrDist,
  sqrDistToLine,
  transformLine,
  transformPoint,
} from "@/_lib/geometry";
import { CSS_PIXELS_PER_INCH } from "@/_lib/pixels-per-inch";
import { Point } from "@/_lib/point";
import Matrix, { inverse } from "ml-matrix";
import React, {
  Dispatch,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { CM } from "@/_lib/unit";
import { drawLine, drawArrow, drawCircle } from "@/_lib/drawing";
import { useTransformContext } from "@/_hooks/use-transform-context";
import { Line } from "@/_lib/interfaces/line";

import { KeyCode } from "@/_lib/key-code";
import LineMenu from "./line-menu";

export default function MeasureCanvas({
  perspective,
  calibrationTransform,
  unitOfMeasure,
  className,
  measuring,
  setMeasuring,
  file,
  children,
}: {
  perspective: Matrix;
  calibrationTransform: Matrix;
  unitOfMeasure: string;
  className?: string;
  measuring: boolean;
  setMeasuring: Dispatch<SetStateAction<boolean>>;
  file: File | null;
  children: React.ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [selectedLine, setSelectedLine] = useState<number>(-1);
  const [selectedEnd, setSelectedEnd] = useState<number>(0);
  const dragOffset = useRef<Point | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [axisConstrained, setAxisConstrained] = useState<boolean>(false);
  const [movingPoint, setMovingPoint] = useState<Point | null>(null);
  const transform = useTransformContext();
  const disablePointer = measuring || selectedEnd >= 0;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const p = { x: e.clientX, y: e.clientY };

    // Possibly select a line.
    if (!startPoint && lines.length > 0) {
      const m = calibrationTransform.mmul(transform);
      for (let i = 0; i < lines.length; i++) {
        const line = transformLine(lines[i], m);
        if (selectedLine == i) {
          if (sqrDist(p, line[0]) < 2000) {
            dragOffset.current = { x: p.x - line[0].x, y: p.y - line[0].y };
            setSelectedEnd(0);
            e.stopPropagation();
            return;
          }
          if (sqrDist(p, line[1]) < 2000) {
            dragOffset.current = { x: p.x - line[1].x, y: p.y - line[1].y };
            setSelectedEnd(1);
            e.stopPropagation();
            return;
          }
        }

        if (sqrDistToLine(line, p) < 600) {
          e.stopPropagation();
          if (i == selectedLine) {
            setSelectedLine(-1);
            return;
          } else {
            setSelectedLine(i);
            return;
          }
        }
      }

      setSelectedLine(-1);
      setSelectedEnd(-1);
    }

    if (!measuring) {
      return;
    }

    e.stopPropagation();
    if (!startPoint) {
      // Begin a new line.
      setStartPoint(p);
      setMovingPoint(p);
    }

    e.stopPropagation();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();

    const p = { x: e.clientX, y: e.clientY };
    if (startPoint && measuring) {
      e.stopPropagation();
      setMovingPoint(p);
    }

    if (e.buttons === 0 && selectedEnd >= 0) {
      e.stopPropagation();
      // If the mouse button is released, end the drag.
      setSelectedEnd(-1);
      return;
    }

    if (selectedLine >= 0 && selectedEnd >= 0 && dragOffset.current) {
      e.stopPropagation();
      const line = lines[selectedLine];
      const m = inverse(transform).mmul(perspective);
      const op = {
        x: p.x - dragOffset.current.x,
        y: p.y - dragOffset.current.y,
      };
      const pt = transformPoint(op, m);
      if (selectedEnd == 0) {
        const newLine: Line = [pt, line[1]];
        setLines(lines.toSpliced(selectedLine, 1, newLine));
      } else {
        const newLine: Line = [line[0], pt];
        setLines(lines.toSpliced(selectedLine, 1, newLine));
      }
      e.stopPropagation();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setSelectedEnd(-1);
    if (!startPoint || !measuring) {
      return;
    }
    const p = { x: e.clientX, y: e.clientY };
    // finish the line.
    const end = axisConstrained
      ? constrainInSpace(p, startPoint, perspective, calibrationTransform)
      : p;
    const m = inverse(transform).mmul(perspective);
    const pdfLine = transformLine([startPoint, end], m);
    setSelectedLine(lines.length);
    setLines([...lines, pdfLine]);
    setStartPoint(null);
    setMeasuring(false);
  };

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.code === KeyCode.Backspace && selectedLine >= 0) {
      handleDeleteLine();
    }
    setAxisConstrained(e.shiftKey);
  }

  function handleDeleteLine() {
    if (selectedLine >= 0) {
      setLines(lines.toSpliced(selectedLine, 1));
      if (selectedLine == 0) {
        setSelectedLine(lines.length - 2);
      } else {
        setSelectedLine(selectedLine - 1);
      }
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.canvas.width = window.innerWidth;
        ctx.canvas.height = window.innerHeight;
        ctx.strokeStyle = "#9333ea";

        ctx.lineWidth = 4;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const m = calibrationTransform.mmul(transform);
        for (let i = 0; i < lines.length; i++) {
          if (i !== selectedLine) {
            drawLine(ctx, transformLine(lines[i], m));
          }
        }
        if (lines.length > 0 && selectedLine >= 0) {
          const line = lines.at(selectedLine);
          if (line) {
            const l = transformLine(line, transform);
            const axis = transformLine(
              [l[0], { x: l[0].x + 96 + 48, y: l[0].y }],
              calibrationTransform,
            );
            ctx.save();
            ctx.lineWidth = 1;
            drawLine(ctx, axis);
            ctx.restore();
            const tl = transformLine(line, m);
            drawArrow(ctx, tl);
            drawCircle(ctx, tl[0], 30);
            drawCircle(ctx, tl[1], 30);
            drawMeasurementsAt(ctx, l, tl[1]);
          }
        }

        if (startPoint && movingPoint) {
          const dest = axisConstrained
            ? constrainInSpace(
                movingPoint,
                startPoint,
                perspective,
                calibrationTransform,
              )
            : movingPoint;
          const screenLine: Line = [startPoint, dest];
          const line = transformLine(screenLine, perspective);
          drawMeasurementsAt(ctx, line, startPoint);
          drawLine(ctx, screenLine);
          const axis = transformLine(
            [line[0], { x: line[0].x + 96 + 48, y: line[0].y }],
            calibrationTransform,
          );
          ctx.save();
          ctx.lineWidth = 1;
          drawLine(ctx, axis);
          ctx.restore();
        }
      }
    }

    function drawMeasurementsAt(
      ctx: CanvasRenderingContext2D,
      line: Line,
      p1: Point,
    ) {
      ctx.save();
      ctx.font = "24px sans-serif";
      ctx.strokeStyle = "#fff";
      ctx.fillStyle = "#000";
      const o = 10;
      const text = measurements(line, unitOfMeasure);
      ctx.lineWidth = 4;
      ctx.strokeText(text, p1.x + o, p1.y + o);
      ctx.fillText(text, p1.x + o, p1.y + o);
      ctx.restore();
    }
  }, [
    startPoint,
    movingPoint,
    perspective,
    unitOfMeasure,
    axisConstrained,
    calibrationTransform,
    lines,
    transform,
    selectedLine,
    measuring,
  ]);

  useEffect(() => {
    setLines([]);
    setSelectedLine(-1);
  }, [file]);

  return (
    <div className={className}>
      <div
        onKeyDown={handleKeyDown}
        onKeyUp={(e) => setAxisConstrained(e.shiftKey)}
        onPointerDownCapture={handlePointerDown}
        onPointerMoveCapture={handlePointerMove}
        onPointerUpCapture={handlePointerUp}
        tabIndex={0}
        className={`${measuring ? "cursor-crosshair" : ""} h-screen w-screen`}
      >
        <div className={`${disablePointer ? "pointer-events-none" : ""}`}>
          {children}
        </div>
        <canvas
          ref={canvasRef}
          className={`absolute top-0 inset-0 w-full h-full pointer-events-none`}
        ></canvas>
      </div>
      <LineMenu
        selectedLine={selectedLine}
        lines={lines}
        setLines={setLines}
        handleDeleteLine={handleDeleteLine}
      />
    </div>
  );
}

function measurements(line: Line, unitOfMeasure: string): string {
  let a = -angleDeg(line);
  if (a < 0) {
    a += 360;
  }
  let label = a.toFixed(0);
  if (label == "360") {
    label = "0";
  }
  const d = distance(line[0], line[1], unitOfMeasure);
  return `${d} ${label}°`;
}

function distance(p1: Point, p2: Point, unitOfMeasure: string): string {
  let d = Math.sqrt(sqrDist(p1, p2)) / CSS_PIXELS_PER_INCH;
  if (unitOfMeasure == CM) {
    d *= 2.54;
  }
  const unit = unitOfMeasure == CM ? "cm" : '"';
  return `${d.toFixed(2)}${unit}`;
}

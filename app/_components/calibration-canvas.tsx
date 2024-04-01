import Matrix from "ml-matrix";
import React, {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  createCheckerboardPattern,
  drawLine,
  interpolateColorRing,
  CanvasState,
} from "@/_lib/drawing";
import { CM, IN } from "@/_lib/unit";
import {
  getPerspectiveTransformFromPoints,
  rectCorners,
  translatePoints,
} from "@/_lib/geometry";
import {
  minIndex,
  sqrdist,
  transformPoints,
  transformPoint,
} from "@/_lib/geometry";
import { mouseToCanvasPoint, Point, touchToCanvasPoint } from "@/_lib/point";
import { DisplaySettings } from "@/_lib/display-settings";
import { CornerColorHex } from "@/_components/theme/colors";
import useProgArrowKeyPoints from "@/_hooks/useProgArrowKeyPoints";

const maxPoints = 4; // One point per vertex in rectangle
const TRANSITION_DURATION = 700;

function getStrokeStyle(pointToModify: number) {
  return [
    CornerColorHex.TOPLEFT,
    CornerColorHex.TOPRIGHT,
    CornerColorHex.BOTTOMRIGHT,
    CornerColorHex.BOTTOMLEFT,
  ][pointToModify % 4];
}

function drawCalibration(cs: CanvasState): void {
  const ctx = cs.ctx;
  ctx.globalCompositeOperation = "source-over";
  if (cs.isConcave) {
    ctx.fillStyle = cs.errorFillPattern;
    drawPolygon(ctx, cs.points, cs.errorFillPattern);
  } else {
    ctx.lineWidth = cs.majorLineWidth;
    drawPolygon(ctx, cs.points, cs.fillColor, cs.gridLineColor);
  }

  /* Only draw the grid if the polygon is convex */
  if (!cs.isConcave) {
    drawGrid(cs, 0);
  }

  ctx.globalCompositeOperation = "difference";

  cs.points.forEach((point, index) => {
    ctx.beginPath();
    ctx.strokeStyle = getStrokeStyle(index);
    if (index !== cs.pointToModify) {
      ctx.arc(point.x, point.y, 10, 0, 2 * Math.PI);
      ctx.lineWidth = 4;
    } else {
      if (cs.isPrecisionMovement) {
        drawCrosshair(ctx, point, 20);
        ctx.lineWidth = 2;
      } else {
        ctx.arc(point.x, point.y, 20, 0, 2 * Math.PI);
        ctx.lineWidth = 4;
      }
    }
    ctx.stroke();
  });
}

function draw(cs: CanvasState): void {
  const ctx = cs.ctx;

  /* Calculate canvas state colors */
  cs.lightColor = "#fff";
  cs.darkColor = "#000";
  cs.greenColor = "#32CD32";
  /* Light color (in light mode) */
  cs.bgColor = interpolateColorRing(
    [cs.lightColor, cs.darkColor, cs.darkColor],
    cs.transitionProgress,
  );
  /* Dark color (in light mode) */
  cs.fillColor = interpolateColorRing(
    [cs.lightColor, cs.darkColor, cs.darkColor],
    cs.transitionProgress,
  );
  /* Grid line color */
  cs.gridLineColor = interpolateColorRing(
    [cs.darkColor, cs.greenColor, cs.lightColor],
    cs.transitionProgress,
  );
  /* Grid line color for projection mode */
  cs.projectionGridLineColor = interpolateColorRing(
    [cs.darkColor, cs.greenColor, cs.lightColor],
    cs.transitionProgress,
  );

  /* Draw background only in calibration mode */
  if (cs.isCalibrating) {
    ctx.fillStyle = cs.bgColor;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  if (cs.isCalibrating) {
    drawCalibration(cs);
  } else if (cs.isConcave) {
    /* If the perspective is invalid, just draw the error
     * fill pattern */
    drawPolygon(ctx, cs.points, cs.errorFillPattern);
  } else {
    /* Draw projection page */
    if (!cs.displaySettings.overlay.disabled) {
      drawOverlays(cs);
    }
  }
}

function drawOverlays(cs: CanvasState) {
  const { grid, border, paper, fliplines } = cs.displaySettings.overlay;
  const ctx = cs.ctx;
  if (grid) {
    ctx.strokeStyle = cs.projectionGridLineColor;
    drawGrid(cs, 8, [1]);
  }
  if (border) {
    drawBorder(cs, cs.darkColor, cs.gridLineColor);
  }
  if (paper) {
    drawPaperSheet(cs);
  }
  if (fliplines) {
    drawCenterLines(cs);
  }
}

function drawCenterLines(cs: CanvasState) {
  const { width, height, ctx, perspective } = cs;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "red";

  function drawProjectedLine(p1: Point, p2: Point) {
    const pts = transformPoints([p1, p2], perspective);
    const lineWidth = 2;
    drawLine(ctx, pts[0], pts[1], lineWidth);
    ctx.stroke();
  }

  // X-axis
  drawProjectedLine({ x: 0, y: height * 0.5 }, { x: width, y: height * 0.5 });
  drawProjectedLine({ x: width * 0.5, y: 0 }, { x: width * 0.5, y: height });

  ctx.restore();
}

function drawPaperSheet(cs: CanvasState) {
  const { ctx, perspective, unitOfMeasure, width, height } = cs;
  const fontSize = 32;

  ctx.save();
  ctx.globalCompositeOperation = "difference";
  ctx.font = `${fontSize}px monospace`;
  ctx.fillStyle = "white";

  const [text, paperWidth, paperHeight] =
    unitOfMeasure == CM ? ["A4", 29.7, 21] : ["11x8.5", 11, 8.5];

  const cornersP = transformPoints(
    translatePoints(
      rectCorners(paperWidth, paperHeight),
      (width - paperWidth) * 0.5,
      (height - paperHeight) * 0.5,
    ),
    perspective,
  );
  drawPolygon(ctx, cornersP);
  ctx.setLineDash([4, 2]);
  ctx.lineWidth = 4;
  ctx.strokeStyle = cs.projectionGridLineColor;
  ctx.stroke();

  const labelWidth = ctx.measureText(text).width;
  ctx.textBaseline = "middle";
  ctx.fillStyle = cs.projectionGridLineColor;
  const centerP = transformPoint(
    {
      x: width * 0.5,
      y: height * 0.5,
    },
    perspective,
  );
  ctx.fillText(text, centerP.x - labelWidth * 0.5, centerP.y);
  ctx.restore();
}

function drawBorder(cs: CanvasState, lineColor: string, dashColor: string) {
  const ctx = cs.ctx;
  ctx.save();
  drawPolygon(ctx, cs.points);
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.lineDashOffset = 0;
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = dashColor;
  ctx.stroke();
  ctx.restore();
}

function drawGrid(cs: CanvasState, outset: number, lineDash?: number[]): void {
  const ctx = cs.ctx;
  ctx.save();
  if (lineDash === undefined) {
    ctx.setLineDash([]);
  } else {
    ctx.setLineDash(lineDash);
  }
  ctx.globalCompositeOperation = "source-over";
  const majorLine = 5;

  /* Vertical lines */
  for (let i = 0; i <= cs.width; i++) {
    let lineWidth = cs.minorLineWidth;
    if (i % majorLine === 0 || i === cs.width) {
      lineWidth = cs.majorLineWidth;
    }
    const line = transformPoints(
      [
        { x: i, y: -outset },
        { x: i, y: cs.height + outset },
      ],
      cs.perspective,
    );
    drawLine(ctx, line[0], line[1], lineWidth);
  }

  /* Horizontal lines */
  for (let i = 0; i <= cs.height; i++) {
    let lineWidth = cs.minorLineWidth;
    if (i % majorLine === 0 || i === cs.height) {
      lineWidth = cs.majorLineWidth;
    }
    const y = cs.height - i;
    const line = transformPoints(
      [
        { x: -outset, y: y },
        { x: cs.width + outset, y: y },
      ],
      cs.perspective,
    );
    drawLine(ctx, line[0], line[1], lineWidth);
  }
  if (cs.isCalibrating) {
    drawDimensionLabels(
      ctx,
      cs.width,
      cs.height,
      cs.perspective,
      cs.unitOfMeasure,
    );
  }
  ctx.restore();
}

function drawDimensionLabels(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  perspective: Matrix,
  unitOfMeasure: string,
) {
  const fontSize = 48;
  const inset = 20;
  ctx.globalCompositeOperation = "difference";
  ctx.font = `${fontSize}px monospace`;
  ctx.fillStyle = "white";
  const widthText = `${width}${unitOfMeasure.toLocaleLowerCase()}`;
  const heightText = `${height}${unitOfMeasure.toLocaleLowerCase()}`;
  const line = transformPoints(
    [
      {
        x: width * 0.5,
        y: height,
      },
      {
        x: 0,
        y: height * 0.5,
      },
    ],
    perspective,
  );
  const widthLabelWidth = ctx.measureText(widthText).width;
  ctx.fillText(widthText, line[0].x - widthLabelWidth * 0.5, line[0].y - inset);
  ctx.fillText(heightText, line[1].x + inset, line[1].y + fontSize * 0.5);
}

function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  point: Point,
  size: number,
) {
  const halfSize = size / 2;
  ctx.beginPath();
  ctx.moveTo(point.x - halfSize, point.y);
  ctx.lineTo(point.x + halfSize, point.y);
  ctx.moveTo(point.x, point.y - halfSize);
  ctx.lineTo(point.x, point.y + halfSize);
}

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  fillStyle?: string | null | CanvasPattern,
  strokeStyle?: string | null,
): void {
  ctx.beginPath();
  for (let p of points) {
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  if (fillStyle !== undefined && fillStyle !== null) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle !== undefined && strokeStyle !== null) {
    ctx.strokeStyle = strokeStyle;
    ctx.stroke();
  }
}

const CORNER_MARGIN = 150;

/**
 * A window width and height canvas used for projector calibration
 * @param draw - Draws in the canvas rendering context
 */
export default function CalibrationCanvas({
  className,
  points,
  setPoints,
  pointToModify,
  setPointToModify,
  width,
  height,
  isCalibrating,
  unitOfMeasure,
  displaySettings,
  setDisplaySettings,
}: {
  className: string | undefined;
  points: Point[];
  setPoints: Dispatch<SetStateAction<Point[]>>;
  pointToModify: number | null;
  setPointToModify: Dispatch<SetStateAction<number | null>>;
  width: number;
  height: number;
  isCalibrating: boolean;
  unitOfMeasure: string;
  displaySettings: DisplaySettings;
  setDisplaySettings: Dispatch<SetStateAction<DisplaySettings>>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const patternRef = useRef<CanvasPattern | null>(null);
  const prevColorModeRef = useRef<number | null>(null);

  const [dragOffset, setDragOffset] = useState<Point | null>(null);
  const [localPoints, setLocalPoints] = useState<Point[]>(points);
  /* transitionProgress ranges from 0 to number of colorMode states + 1 */
  const [transitionProgress, setTransitionProgress] = useState<number>(0);
  const [colorMode, setColorMode] = useState<number | null>(null);

  const minColorMode = 0;
  const maxColorMode = 2;

  useEffect(() => {
    var _colorMode;
    /* The order is important here. The colorModes should monotonically
     * increase each time it changes */
    if (displaySettings.inverted && displaySettings.isInvertedGreen) {
      _colorMode = 1;
    } else if (displaySettings.inverted) {
      _colorMode = 2;
    } else {
      _colorMode = 0;
    }

    setColorMode(_colorMode);
    /* Initialize prevColorModeRef if needed */
    if (prevColorModeRef.current == null) prevColorModeRef.current = _colorMode;
  }, [displaySettings]);

  useEffect(() => {
    /* No colorMode set yet, nothing to do */
    if (colorMode == null) return;

    const prevColorMode = prevColorModeRef.current;
    prevColorModeRef.current = colorMode;

    /* No previous color mode, nothing to do */
    if (prevColorMode == null) return;

    /* No transition necessary (probably just initialized) */
    if (colorMode == prevColorMode) {
      setTransitionProgress(colorMode);
      return;
    }

    let frameId: number;
    const startTime = Date.now();
    const duration = TRANSITION_DURATION;
    /* Start from our current progress (avoids jumping on double-click) */
    const startTransitionProgress = transitionProgress;
    let endTransitionProgress = colorMode;
    /* Only allow forward progression */
    if (colorMode == minColorMode) {
      endTransitionProgress = maxColorMode + 1;
    }
    const transitionDistance = endTransitionProgress - startTransitionProgress;

    const animate = () => {
      const elapsedTime = Date.now() - startTime;
      /* progress is a number between 0 and 1 */
      const progress = Math.min(elapsedTime / duration, 1);
      let newTransitionProgress =
        startTransitionProgress + progress * transitionDistance;
      /* Keep transitionProgress in the range
       * 0 (inclusive) to maxColorMode + 1 (exclusive) */
      newTransitionProgress %= maxColorMode + 1;
      setTransitionProgress(newTransitionProgress);

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [colorMode]);

  useEffect(() => {
    setLocalPoints(points);
  }, [points, setLocalPoints]);

  /* Used to create the error fill pattern */
  useEffect(() => {
    if (!canvasRef === null || canvasRef.current === null) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      patternRef.current = createCheckerboardPattern(ctx, 3, "#555", "#CCC");
    }
  }, []);

  useEffect(() => {
    if (
      canvasRef !== null &&
      canvasRef.current !== null &&
      patternRef !== null &&
      patternRef.current !== null &&
      localPoints &&
      localPoints.length === maxPoints
    ) {
      /* All drawing is done in unitsOfMeasure, ptDensity = 1.0 */
      let perspective_mtx = getPerspectiveTransformFromPoints(
        localPoints,
        width,
        height,
        1.0,
        false,
      );

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      if (ctx !== null) {
        ctx.canvas.width = window.innerWidth;
        ctx.canvas.height = window.innerHeight;
        let cs = new CanvasState(
          ctx,
          { x: 0, y: 0 },
          localPoints,
          width,
          height,
          perspective_mtx,
          isCalibrating,
          pointToModify,
          unitOfMeasure,
          false,
          patternRef.current,
          transitionProgress,
          displaySettings,
        );
        draw(cs);
      }
    }
  }, [
    localPoints,
    width,
    height,
    isCalibrating,
    pointToModify,
    unitOfMeasure,
    transitionProgress,
    displaySettings,
  ]);

  function getNearbyCorner(p: Point): number {
    const distances = localPoints.map((a) => sqrdist(a, p));
    const corner = minIndex(distances);
    if (CORNER_MARGIN * CORNER_MARGIN > distances[corner]) {
      return corner;
    }
    return -1;
  }

  const handleKeyDown = useCallback(
    function (e: React.KeyboardEvent) {
      if (e.code === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          setDisplaySettings({
            ...displaySettings,
            isFourCorners: !displaySettings.isFourCorners,
          });
        } else {
          const newPointToModify =
            (pointToModify === null ? 0 : pointToModify + 1) %
            localPoints.length;
          setPointToModify(newPointToModify);
        }
      } else if (e.code === "Escape") {
        if (pointToModify !== null) {
          if (e.target instanceof HTMLElement) {
            e.target.blur();
          }
          setPointToModify(null);
        }
      }
    },
    [
      pointToModify,
      displaySettings,
      setPointToModify,
      localPoints.length,
      setDisplaySettings,
    ],
  );

  useProgArrowKeyPoints(points, setPoints, pointToModify, isCalibrating);

  function handlePointerDown(e: React.PointerEvent) {
    const p = { x: e.clientX, y: e.clientY };
    if (localPoints.length < maxPoints) {
      setLocalPoints([...localPoints, p]);
    } else {
      const corner = getNearbyCorner(p);
      if (corner !== -1) {
        let current = localPoints[corner];
        setDragOffset({ x: current.x - p.x, y: current.y - p.y });
        setPointToModify(corner);
      } else {
        setPointToModify(null);
      }
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (pointToModify === null || dragOffset == null) return;
    const p = { x: e.clientX, y: e.clientY };
    const newPoints = [...localPoints];
    newPoints[pointToModify] = {
      x: p.x + dragOffset.x,
      y: p.y + dragOffset.y,
    };
    setLocalPoints(newPoints);
  }

  function handlePointerUp() {
    /* Nothing to do. This short circuit is required to prevent setting
     * the localStorage of the points to invalid values */
    if (dragOffset === null) return;

    localStorage.setItem("points", JSON.stringify(localPoints));
    setPoints(localPoints);
    setDragOffset(null);
  }

  return (
    <canvas
      tabIndex={0}
      ref={canvasRef}
      className={`${className} outline-none`}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        pointerEvents: isCalibrating ? "auto" : "none",
      }}
    />
  );
}

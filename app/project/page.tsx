"use client";

import Matrix from "ml-matrix";
import Link from "next/link";
import { ChangeEvent, useEffect, useState } from "react";
import { FullScreen, useFullScreenHandle } from "react-full-screen";

import CalibrationCanvas from "@/_components/calibration-canvas";
import DimensionsInput from "@/_components/dimensions-input";
import Draggable from "@/_components/draggable";
import FileInput from "@/_components/file-input";
import FullScreenButton from "@/_components/full-screen-button";
import PDFViewer from "@/_components/pdf-viewer";
import ArrowBackIcon from "@/_icons/arrow-back-icon";
import FlipHorizontalIcon from "@/_icons/flip-horizontal-icon";
import FlipHorizontalOffIcon from "@/_icons/flip-horizontal-off-icon";
import FlipVerticalIcon from "@/_icons/flip-vertical-icon";
import FlipVerticalOffIcon from "@/_icons/flip-vertical-off-icon";
import GridOffIcon from "@/_icons/grid-off-icon";
import GridOnIcon from "@/_icons/grid-on-icon";
import InvertColorIcon from "@/_icons/invert-color-icon";
import InvertColorOffIcon from "@/_icons/invert-color-off-icon";
import Rotate90DegreesCWIcon from "@/_icons/rotate-90-degrees-cw-icon";
import {
  getPerspectiveTransform,
  minIndex,
  sqrdist,
  toMatrix3d,
} from "@/_lib/geometry";
import isValidPDF from "@/_lib/is-valid-pdf";
import Point from "@/_lib/point";
import removeNonDigits from "@/_lib/remove-non-digits";

export default function Page() {
  const defaultWidthDimensionValue = "24";
  const defaultHeightDimensionValue = "18";
  const handle = useFullScreenHandle();
  const maxPoints = 4; // One point per vertex in rectangle
  const radius = 30;

  const [points, setPoints] = useState<Point[]>([
    // Default points that match closely enough to my setup with a 24 x 18 inch mat
    { x: 190, y: 190 },
    { x: 1150, y: 160 },
    { x: 1150, y: 900 },
    { x: 160, y: 900 },
  ]);
  const [degrees, setDegrees] = useState<number>(0);
  const [pointToModiy, setPointToModify] = useState<number | null>(null);
  const [width, setWidth] = useState(defaultWidthDimensionValue);
  const [height, setHeight] = useState(defaultHeightDimensionValue);
  const [isCalibrating, setIsCalibrating] = useState(true);
  const [perspective, setPerspective] = useState<Matrix>(Matrix.identity(3, 3));
  const [localTransform, setLocalTransform] = useState<Matrix>(
    Matrix.identity(3, 3)
  );
  const [matrix3d, setMatrix3d] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [inverted, setInverted] = useState<boolean>(true);
  const [scale, setScale] = useState<Point>({ x: 1, y: 1 });
  const [gridOn, setGridOn] = useState<boolean>(false);

  function draw(ctx: CanvasRenderingContext2D): void {
    const rect = ctx.canvas.getBoundingClientRect(); // Find position of canvas below navbar to offset x and y
    ctx.strokeStyle = "#36cf11";

    let prev = points[0];
    for (let point of points) {
      ctx.moveTo(prev.x - rect.left, prev.y - rect.top);
      ctx.lineTo(point.x - rect.left, point.y - rect.top);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(point.x - rect.left, point.y - rect.top, radius, 0, Math.PI * 2);
      ctx.stroke();
      prev = point;
    }

    if (points.length === maxPoints) {
      ctx.moveTo(prev.x - rect.left, prev.y - rect.top);
      ctx.lineTo(points[0].x - rect.left, points[0].y - rect.top);
      ctx.stroke();
    }
  }

  // HANDLERS

  function handleHeightChange(e: ChangeEvent<HTMLInputElement>) {
    const height = removeNonDigits(e.target.value);
    setHeight(height);
  }

  function handleWidthChange(e: ChangeEvent<HTMLInputElement>) {
    const width = removeNonDigits(e.target.value);
    setWidth(width);
  }

  function handleDown(newPoint: Point) {
    if (points.length < maxPoints) {
      setPoints([...points, newPoint]);
    } else {
      setPointToModify(minIndex(points.map((a) => sqrdist(a, newPoint))));
    }
  }

  function handleMove(p: Point) {
    if (pointToModiy !== null) {
      const newPoints = [...points];
      newPoints[pointToModiy] = p;
      setPoints(newPoints);
    }
  }

  function handleUp() {
    localStorage.setItem("points", JSON.stringify(points));
    setPointToModify(null);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>): void {
    const { files } = e.target;

    if (files && files[0] && isValidPDF(files[0])) {
      setFile(files[0]);
    }
  }

  // EFFECTS

  useEffect(() => {
    const localPoints = localStorage.getItem("points");
    if (localPoints !== null) {
      setPoints(JSON.parse(localPoints));
    }
  }, []);

  useEffect(() => {
    setMatrix3d(toMatrix3d(localTransform));
  }, [localTransform]);

  useEffect(() => {
    if (points.length === maxPoints) {
      let m = getPerspectiveTransform(points, getDstVertices());
      let n = getPerspectiveTransform(getDstVertices(), points);
      setPerspective(m);
      setLocalTransform(n);
    }

    function getDstVertices(): Point[] {
      const ppi = 96; // defined by css.
      const ox = 0;
      const oy = 0;
      const mx = +width * ppi + ox;
      const my = +height * ppi + oy;

      const dstVertices = [
        { x: ox, y: oy },
        { x: mx, y: oy },
        { x: mx, y: my },
        { x: ox, y: my },
      ];

      return dstVertices;
    }
  }, [points, width, height]);

  return (
    <main>
      <FullScreen handle={handle}>
        <div className="flex flex-wrap items-center gap-4 m-4">
          <Link href="/">
            <ArrowBackIcon />
          </Link>
          <button
            className="z-10 text-gray-900 bg-white border border-gray-300 focus:outline-none hover:bg-gray-100 focus:ring-4 focus:ring-gray-200 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-600 dark:focus:ring-gray-700"
            onClick={() => setIsCalibrating(!isCalibrating)}
          >
            {isCalibrating ? "Show Pattern" : "Show Calibration"}
          </button>
          {!isCalibrating && (
            <>
              <FileInput
                accept="application/pdf"
                handleChange={handleFileChange}
                id="pdfFile"
              ></FileInput>

              <button
                className={"z-10"}
                name={"Invert colors"}
                onClick={() => setInverted(!inverted)}
              >
                {inverted ? <InvertColorOffIcon /> : <InvertColorIcon />}
              </button>

              <button
                className={"z-10"}
                name={"Flip vertically"}
                onClick={() => setScale({ x: scale.x * -1, y: scale.y })}
              >
                {scale.x === -1 ? (
                  <FlipVerticalOffIcon />
                ) : (
                  <FlipVerticalIcon />
                )}
              </button>

              <button
                className={"z-10"}
                name={"Flip horizontally"}
                onClick={() => setScale({ x: scale.x, y: scale.y * -1 })}
              >
                {scale.y === -1 ? (
                  <FlipHorizontalOffIcon />
                ) : (
                  <FlipHorizontalIcon />
                )}
              </button>

              <button
                className={"z-10"}
                name={"Rotate 90 degrees clockwise"}
                onClick={() => setDegrees((degrees + 90) % 360)}
              >
                <Rotate90DegreesCWIcon />
              </button>

              <button
                className={"z-10"}
                name={"Toggle calibration grid"}
                onClick={() => setGridOn(!gridOn)}
              >
                {gridOn ? <GridOnIcon /> : <GridOffIcon />}
              </button>
            </>
          )}

          {isCalibrating && (
            <DimensionsInput
              width={width}
              height={height}
              handleWidthChange={handleWidthChange}
              handleHeightChange={handleHeightChange}
            />
          )}

          <FullScreenButton className="z-10 ml-auto" handle={handle} />
        </div>

        {isCalibrating && (
          <CalibrationCanvas
            className="absolute cursor-crosshair z-10"
            handleDown={handleDown}
            handleUp={handleUp}
            handleMove={handleMove}
            draw={draw}
          />
        )}

        {!isCalibrating && (
          <Draggable
            localTransform={localTransform}
            setLocalTransform={setLocalTransform}
            perspective={perspective}
          >
            <div
              className={"absolute z-0"}
              style={{
                transform: `${matrix3d}`,
                transformOrigin: "0 0",
                filter: `invert(${inverted ? "1" : "0"})`,
              }}
            >
              <div
                style={{
                  transform: `scale(${scale.x}, ${scale.y}) rotate(${degrees}deg)`,
                  transformOrigin: "center",
                }}
              >
                {gridOn ? (
                  <PDFViewer
                    file={{
                      url: "/1-inch-grid.pdf",
                    }}
                  />
                ) : (
                  <PDFViewer file={file} />
                )}
              </div>
            </div>
          </Draggable>
        )}
      </FullScreen>
    </main>
  );
}

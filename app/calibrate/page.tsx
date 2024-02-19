"use client";

import Matrix from "ml-matrix";
import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { FullScreen, useFullScreenHandle } from "react-full-screen";

import CalibrationCanvas from "@/_components/calibration-canvas";
import Draggable from "@/_components/draggable";
import FileInput from "@/_components/file-input";
import FullScreenButton from "@/_components/full-screen-button";
import LabelledInput from "@/_components/labelled-input";
import PDFViewer from "@/_components/pdf-viewer";
import CloseIcon from "@/_icons/close-icon";
import DeleteIcon from "@/_icons/delete-icon";
import FlipHorizontalIcon from "@/_icons/flip-horizontal-icon";
import FlipHorizontalOffIcon from "@/_icons/flip-horizontal-off-icon";
import FlipVerticalIcon from "@/_icons/flip-vertical-icon";
import FlipVerticalOffIcon from "@/_icons/flip-vertical-off-icon";
import InvertColorIcon from "@/_icons/invert-color-icon";
import InvertColorOffIcon from "@/_icons/invert-color-off-icon";
import PdfIcon from "@/_icons/pdf-icon";
import Rotate90DegreesCWIcon from "@/_icons/rotate-90-degrees-cw-icon";
import {
  getPerspectiveTransform,
  toMatrix3d,
  translate,
} from "@/_lib/geometry";
import isValidPDF from "@/_lib/is-valid-pdf";
import { Point } from "@/_lib/point";
import removeNonDigits from "@/_lib/remove-non-digits";

const sePoints = [
  // Points that fit on an iPhone SE
  { x: 100, y: 300 },
  { x: 300, y: 300 },
  { x: 300, y: 600 },
  { x: 100, y: 600 },
];

function resetPoints(): Point[] {
  return sePoints; // TODO: Do based on screen size
}

export default function Page() {
  const defaultWidthDimensionValue = "24";
  const defaultHeightDimensionValue = "18";
  const maxPoints = 4; // One point per vertex in rectangle

  const handle = useFullScreenHandle();

  const [points, setPoints] = useState<Point[]>(sePoints);
  const [degrees, setDegrees] = useState<number>(0);
  const [pointToModify, setPointToModify] = useState<number | null>(null);
  const [width, setWidth] = useState(defaultWidthDimensionValue);
  const [height, setHeight] = useState(defaultHeightDimensionValue);
  const [isCalibrating, setIsCalibrating] = useState(true);
  const [perspective, setPerspective] = useState<Matrix>(Matrix.identity(3, 3));
  const [matrix3d, setMatrix3d] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [inverted, setInverted] = useState<boolean>(false);
  const [scale, setScale] = useState<Point>({ x: 1, y: 1 });
  const [controlsOn, setControlsOn] = useState<boolean>(true);
  const [lastMoveTime, setLastMoveTime] = useState<number>(Date.now());
  const [windowScreen, setWindowScreen] = useState<Point>({ x: 0, y: 0 });
  const [localTransform, setLocalTransform] = useState<Matrix>(
    Matrix.identity(3, 3)
  );
  const [calibrationTransform, setCalibrationTransform] = useState<Matrix>(
    Matrix.identity(3, 3)
  );
  const [canvasOffset, setCanvasOffset] = useState<Point>({ x: 0, y: 0 });

  function visible(b: boolean): string {
    return b ? "visible" : "hidden";
  }

  // HANDLERS

  function handleHeightChange(e: ChangeEvent<HTMLInputElement>) {
    const h = removeNonDigits(e.target.value, height);
    setHeight(h);
  }

  function handleWidthChange(e: ChangeEvent<HTMLInputElement>) {
    const w = removeNonDigits(e.target.value, width);
    setWidth(w);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>): void {
    const { files } = e.target;

    if (files && files[0] && isValidPDF(files[0])) {
      setFile(files[0]);
    }
  }

  function handleShowControls(
    e: React.MouseEvent<Element> | React.TouchEvent<Element>
  ): void {
    setControlsOn(true);
    setLastMoveTime(Date.now());
  }

  // EFFECTS

  const requestWakeLock = useCallback(async () => {
    if ("wakeLock" in navigator) {
      try {
        await navigator.wakeLock.request("screen");
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    requestWakeLock();
  });

  useEffect(() => {
    const dy = windowScreen.y + window.outerHeight - window.innerHeight;
    const dx = windowScreen.x + window.outerWidth - window.innerWidth;
    setCanvasOffset({ x: -dx, y: -dy });
  }, [windowScreen]);

  useEffect(() => {
    const interval = setInterval(() => {
      const p = { x: window.screenX, y: window.screenY };
      if (windowScreen.x !== p.x || windowScreen.y !== p.y) {
        setWindowScreen(p);
      }
    }, 500);
  });

  useEffect(() => {
    const controlTimeoutInMilliseconds = 5000;
    const interval = setInterval(() => {
      if (
        controlsOn &&
        Date.now() - lastMoveTime > controlTimeoutInMilliseconds
      ) {
        setControlsOn(false);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [controlsOn, lastMoveTime]);

  useEffect(() => {
    const localPoints = localStorage.getItem("points");
    if (localPoints !== null) {
      setPoints(JSON.parse(localPoints));
    } else {
      setPoints(resetPoints());
    }
  }, []);

  useEffect(() => {
    const offset = translate(canvasOffset);
    setMatrix3d(toMatrix3d(offset.mmul(localTransform)));
  }, [localTransform, canvasOffset]);

  useEffect(() => {
    if (points && points.length === maxPoints) {
      let m = getPerspectiveTransform(points, getDstVertices());
      let n = getPerspectiveTransform(getDstVertices(), points);
      setPerspective(m);
      setLocalTransform(n);
      setCalibrationTransform(n);
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
    <main
      onMouseMove={(e) => handleShowControls(e)}
      onTouchStart={(e) => handleShowControls(e)}
      style={{
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        backgroundColor: "white",
      }}
    >
      <FullScreen handle={handle} className="flex items-start bg-white">
        <div
          className={`z-20 h-full absolute ${
            isCalibrating || controlsOn ? "opacity-100" : "opacity-0"
          } transition-opacity ease-in-out duration-1000 `}
        >
          <div
            className={`items-center gap-4 m-4 flex-col flex h-screen justify-center`}
          >
            <Link href="/">
              <CloseIcon />
            </Link>
            <button
              className=" text-white bg-gradient-to-br from-purple-600 to-blue-500 hover:bg-gradient-to-bl focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
              onClick={() => setIsCalibrating(!isCalibrating)}
            >
              {isCalibrating ? "Project" : "Calibrate"}
            </button>
            <label
              className={`items-center justify-center m-4 block ${visible(
                !isCalibrating
              )}`}
            >
              <FileInput
                accept="application/pdf"
                className={`hidden`}
                handleChange={handleFileChange}
                id="pdfFile"
              ></FileInput>
              <PdfIcon />
            </label>
            <button
              className={`${visible(!isCalibrating)} block  m-4`}
              name={"Invert colors"}
              onClick={() => setInverted(!inverted)}
            >
              {inverted ? <InvertColorOffIcon /> : <InvertColorIcon />}
            </button>
            <button
              className={`${visible(!isCalibrating)} block  m-4`}
              name={"Flip vertically"}
              onClick={() => setScale({ x: scale.x * -1, y: scale.y })}
            >
              {scale.x === -1 ? <FlipVerticalOffIcon /> : <FlipVerticalIcon />}
            </button>
            <button
              className={`${visible(!isCalibrating)} block m-4`}
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
              className={`${visible(!isCalibrating)} block m-4`}
              name={"Rotate 90 degrees clockwise"}
              onClick={() => setDegrees((degrees + 90) % 360)}
              style={{
                transform: `rotate(${degrees}deg)`,
                transformOrigin: "center",
              }}
            >
              <Rotate90DegreesCWIcon />
            </button>
            <LabelledInput
              className={`${visible(isCalibrating)}`}
              handleChange={handleWidthChange}
              id="width"
              inputTestId="width"
              label="Width (in)"
              name="width"
              value={width}
            />
            <LabelledInput
              className={`${visible(isCalibrating)}`}
              handleChange={handleHeightChange}
              id="height"
              inputTestId="height"
              label="Height (in)"
              name="height"
              value={height}
            />
            <button
              className={`${visible(isCalibrating)} block m-4`}
              name={"Delete points"}
              onClick={() => resetPoints()}
            >
              <DeleteIcon />
            </button>
            <FullScreenButton className={`z-20 block m-4`} handle={handle} />
          </div>
        </div>

        <CalibrationCanvas
          className={`absolute z-10`}
          canvasOffset={canvasOffset}
          points={points}
          setPoints={setPoints}
          pointToModify={pointToModify}
          setPointToModify={setPointToModify}
          perspective={calibrationTransform}
          width={+width}
          height={+height}
          isCalibrating={isCalibrating}
        />
        <Draggable
          className={`cursor-grabbing select-none ${visible(!isCalibrating)}`}
          localTransform={localTransform}
          setLocalTransform={setLocalTransform}
          perspective={perspective}
          windowScreen={windowScreen}
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
              <PDFViewer file={file} />
            </div>
          </div>
        </Draggable>
      </FullScreen>
    </main>
  );
}

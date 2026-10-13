export interface LpProblem {
  numVariables: number;
  objective: number[]; // Minimierungs-Koeffizienten c
  constraints: Array<{
    coefficients: number[];
    operator: '<=' | '>=' | '=';
    rhs: number;
  }>;
  lowerBounds?: number[];
  upperBounds?: number[];
  binaryVariables?: number[]; // Indizes von 0/1-Variablen
}

export interface LpSolution {
  isFeasible: boolean;
  isOptimal: boolean;
  objectiveValue: number;
  variableValues: number[];
  nodesExplored?: number;
  timedOut?: boolean;
}

/**
 * 2-Phasen-Simplex-Algorithmus fuer reelle lineare Programme.
 */
class DenseSimplex {
  private static readonly EPSILON = 1e-7;

  public static solve(
    c: number[],
    A: number[][],
    b: number[],
    eqCount: number
  ): { isFeasible: boolean; objectiveValue: number; x: number[] } {
    const m = A.length;
    if (m === 0) {
      return { isFeasible: true, objectiveValue: 0, x: [] };
    }
    const n = c.length;

    // Standardisierung: b >= 0 sicherstellen
    const matrixA: number[][] = [];
    const vectorB: number[] = [...b];
    for (let i = 0; i < m; i++) {
      matrixA[i] = [...A[i]];
      if (vectorB[i] < 0) {
        vectorB[i] = -vectorB[i];
        for (let j = 0; j < n; j++) {
          matrixA[i][j] = -matrixA[i][j];
        }
      }
    }

    // Phase 1 Setup: Kuenstliche Variablen fuer Zeilen hinzufuegen
    // Anzahl Schlupf-/Surplus- und kuenstliche Variablen bestimmen
    // m Zeilen, n urspruengliche Variablen
    // Tableau: Zeilen = m + 2 (Phase 1 Kosten, Phase 2 Kosten), Spalten = Gesamt + 1 (RHS)
    const artVars: number[] = [];
    for (let i = 0; i < m; i++) {
      artVars.push(i);
    }
    const numArt = m;
    const totalCols = n + numArt + 1; // n original + m artificial + 1 RHS

    // Initiales Tableau aufbauen
    // Zeile 0: Phase 1 Zielfunktion (Minimierung der kuenstlichen Variablen)
    // Zeilen 1..m: Restriktionen
    const tableau: number[][] = Array.from({ length: m + 1 }, () => new Array(totalCols).fill(0));

    // Gleichungen eintragen
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        tableau[i + 1][j] = matrixA[i][j];
      }
      tableau[i + 1][n + i] = 1; // Kuenstliche Variable fuer Zeile i
      tableau[i + 1][totalCols - 1] = vectorB[i];
    }

    // Phase 1 Kostenzeile initialisieren (Summe ueber kuenstliche Variablen)
    // Minimierung von Summe(art_i) -> Im Tableau: w - sum(art_i) = 0
    // Durch Zeilenoperationen eliminieren
    for (let j = 0; j < totalCols; j++) {
      let sum = 0;
      for (let i = 0; i < m; i++) {
        sum += tableau[i + 1][j];
      }
      tableau[0][j] = -sum;
    }

    const basis: number[] = artVars.map((i) => n + i);

    // Phase 1 loesen
    DenseSimplex.pivotSimplex(tableau, basis, 0);

    const phase1Opt = tableau[0][totalCols - 1];
    if (Math.abs(phase1Opt) > DenseSimplex.EPSILON) {
      // Problem ist unzulaessig
      return { isFeasible: false, objectiveValue: Infinity, x: [] };
    }

    // Phase 2 Setup: Kuenstliche Spalten entfernen und urspruengliche Kosten einsetzen
    const phase2Cols = n + 1;
    const tableau2: number[][] = Array.from({ length: m + 1 }, () => new Array(phase2Cols).fill(0));

    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        tableau2[i + 1][j] = tableau[i + 1][j];
      }
      tableau2[i + 1][phase2Cols - 1] = tableau[i + 1][totalCols - 1];
    }

    // Phase 2 Zielfunktionszeile eintragen: c^T * x
    for (let j = 0; j < n; j++) {
      tableau2[0][j] = c[j];
    }

    // Basiseintraege in Zeile 0 eliminieren
    for (let i = 0; i < m; i++) {
      const basicCol = basis[i];
      if (basicCol < n) {
        const factor = tableau2[0][basicCol];
        if (Math.abs(factor) > DenseSimplex.EPSILON) {
          for (let j = 0; j < phase2Cols; j++) {
            tableau2[0][j] -= factor * tableau2[i + 1][j];
          }
        }
      }
    }

    // Phase 2 loesen
    DenseSimplex.pivotSimplex(tableau2, basis, 0);

    const x: number[] = new Array(n).fill(0);
    for (let i = 0; i < m; i++) {
      if (basis[i] < n) {
        x[basis[i]] = Math.max(0, tableau2[i + 1][phase2Cols - 1]);
      }
    }

    let obj = 0;
    for (let j = 0; j < n; j++) {
      obj += c[j] * x[j];
    }

    return { isFeasible: true, objectiveValue: obj, x };
  }

  private static pivotSimplex(tableau: number[][], basis: number[], costRowIndex: number): void {
    const m = tableau.length - 1;
    const cols = tableau[0].length;
    const maxIter = 1000;
    let iter = 0;

    while (iter++ < maxIter) {
      // Pivot-Spalte waehlen (Bland's Rule: kleinster Index mit negativem Koeffizienten fuer Minimierung)
      let pivotCol = -1;
      for (let j = 0; j < cols - 1; j++) {
        if (tableau[costRowIndex][j] < -DenseSimplex.EPSILON) {
          pivotCol = j;
          break;
        }
      }

      if (pivotCol === -1) {
        // Optimalitaetskriterium erfuellt
        break;
      }

      // Pivot-Zeile waehlen (Minimum-Ratio-Test)
      let pivotRow = -1;
      let minRatio = Infinity;

      for (let i = 1; i <= m; i++) {
        const coeff = tableau[i][pivotCol];
        if (coeff > DenseSimplex.EPSILON) {
          const ratio = tableau[i][cols - 1] / coeff;
          if (ratio < minRatio - DenseSimplex.EPSILON) {
            minRatio = ratio;
            pivotRow = i;
          }
        }
      }

      if (pivotRow === -1) {
        // Unbeschraenktes Problem
        break;
      }

      // Gauß-Jordan Pivot-Operation
      const pivotVal = tableau[pivotRow][pivotCol];
      for (let j = 0; j < cols; j++) {
        tableau[pivotRow][j] /= pivotVal;
      }

      for (let i = 0; i <= m; i++) {
        if (i !== pivotRow) {
          const factor = tableau[i][pivotCol];
          if (Math.abs(factor) > DenseSimplex.EPSILON) {
            for (let j = 0; j < cols; j++) {
              tableau[i][j] -= factor * tableau[pivotRow][j];
            }
          }
        }
      }

      basis[pivotRow - 1] = pivotCol;
    }
  }
}

/**
 * Branch-and-Bound Engine fuer binaere (0/1) gemischt-ganzzahlige Programme (MILP).
 */
export class SimplexSolver {
  public static async solveMilp(
    problem: LpProblem,
    options: { maxTimeMs?: number; maxNodes?: number } = {}
  ): Promise<LpSolution> {
    const startTime = performance.now();
    const maxTimeMs = options.maxTimeMs ?? 500;
    const maxNodes = options.maxNodes ?? 1500;

    const numVars = problem.numVariables;
    const binarySet = new Set(problem.binaryVariables || []);

    // Standardform der Restriktionen aufbauen: sum(a_ij * x_j) + slack_i = b_i
    const origA: number[][] = [];
    const origB: number[] = [];
    let slackCount = 0;

    for (const c of problem.constraints) {
      if (c.operator === '<=') {
        const row = [...c.coefficients];
        origA.push(row);
        origB.push(c.rhs);
        slackCount++;
      } else if (c.operator === '>=') {
        // Multipliziere mit -1 fuer <= Form
        const row = c.coefficients.map((v) => -v);
        origA.push(row);
        origB.push(-c.rhs);
        slackCount++;
      } else {
        // Gleichung =
        origA.push([...c.coefficients]);
        origB.push(c.rhs);
      }
    }

    const totalVarsWithSlack = numVars + slackCount;
    const matrixA: number[][] = [];
    let currentSlack = 0;

    for (let i = 0; i < origA.length; i++) {
      const row = new Array(totalVarsWithSlack).fill(0);
      for (let j = 0; j < numVars; j++) {
        row[j] = origA[i][j];
      }
      const origConstraint = problem.constraints[i];
      if (origConstraint.operator === '<=' || origConstraint.operator === '>=') {
        row[numVars + currentSlack] = 1;
        currentSlack++;
      }
      matrixA.push(row);
    }

    // Zielfunktion fuer alle Variablen (Slack-Variablen haben Kosten 0)
    const costVector = new Array(totalVarsWithSlack).fill(0);
    for (let j = 0; j < numVars; j++) {
      costVector[j] = problem.objective[j] || 0;
    }

    interface BbNode {
      lowerBounds: number[];
      upperBounds: number[];
    }

    const initialLower = new Array(totalVarsWithSlack).fill(0);
    const initialUpper = new Array(totalVarsWithSlack).fill(Infinity);
    for (const bIdx of binarySet) {
      initialUpper[bIdx] = 1;
    }

    const stack: BbNode[] = [
      {
        lowerBounds: initialLower,
        upperBounds: initialUpper,
      },
    ];

    let bestObjective = Infinity;
    let bestX: number[] = [];
    let nodesExplored = 0;
    let timedOut = false;

    while (stack.length > 0) {
      // Asynchroner Time-Slice Guard alle 50 Knoten zur Entlastung der Node.js Event-Loop
      if (nodesExplored % 50 === 0 && nodesExplored > 0) {
        if (performance.now() - startTime > maxTimeMs) {
          timedOut = true;
          break;
        }
        await new Promise((resolve) => setImmediate(resolve));
      }

      if (nodesExplored++ >= maxNodes) {
        timedOut = true;
        break;
      }

      const node = stack.pop()!;

      // Erweitere A und b um die Schranken des aktuellen Knotens
      const nodeA: number[][] = matrixA.map((r) => [...r]);
      const nodeB: number[] = [...origB];

      // Untere Schranken l_j: x_j >= l_j  ->  -x_j + s = -l_j
      for (let j = 0; j < totalVarsWithSlack; j++) {
        if (node.lowerBounds[j] > 0) {
          const boundRow = new Array(totalVarsWithSlack).fill(0);
          boundRow[j] = -1;
          nodeA.push(boundRow);
          nodeB.push(-node.lowerBounds[j]);
        }
        if (node.upperBounds[j] < Infinity) {
          const boundRow = new Array(totalVarsWithSlack).fill(0);
          boundRow[j] = 1;
          nodeA.push(boundRow);
          nodeB.push(node.upperBounds[j]);
        }
      }

      // LP-Relaxierung loesen
      const lpResult = DenseSimplex.solve(costVector, nodeA, nodeB, 0);

      if (!lpResult.isFeasible) {
        // Ast ist mathematisch unzulaessig -> Pruning
        continue;
      }

      if (lpResult.objectiveValue >= bestObjective - 1e-6) {
        // Schlechtere Loesung als bisheriger Incumbent -> Pruning
        continue;
      }

      // Pruefe Ganzzahligkeit fuer binaere Entscheidungsvariablen
      let mostFractionalVar = -1;
      let maxFractionality = 0;

      for (const bIdx of binarySet) {
        const val = lpResult.x[bIdx] || 0;
        const distToInteger = Math.abs(val - Math.round(val));
        if (distToInteger > 0.05) {
          if (distToInteger > maxFractionality) {
            maxFractionality = distToInteger;
            mostFractionalVar = bIdx;
          }
        }
      }

      if (mostFractionalVar === -1) {
        // Alle binaeren Variablen sind ganzzahlig (0 oder 1)!
        bestObjective = lpResult.objectiveValue;
        bestX = lpResult.x.slice(0, numVars);
      } else {
        // Verzweigung (Branching) auf mostFractionalVar
        // Zweig 1: x_i = 0
        const leftLower = [...node.lowerBounds];
        const leftUpper = [...node.upperBounds];
        leftUpper[mostFractionalVar] = 0;

        // Zweig 2: x_i = 1
        const rightLower = [...node.lowerBounds];
        const rightUpper = [...node.upperBounds];
        rightLower[mostFractionalVar] = 1;

        // Best-First Heuristik: Fuege beide Zweige auf den Stack
        stack.push({ lowerBounds: leftLower, upperBounds: leftUpper });
        stack.push({ lowerBounds: rightLower, upperBounds: rightUpper });
      }
    }

    const hasSolution = bestX.length > 0;

    return {
      isFeasible: hasSolution,
      isOptimal: hasSolution && !timedOut,
      objectiveValue: hasSolution ? bestObjective : Infinity,
      variableValues: bestX,
      nodesExplored,
      timedOut,
    };
  }
}

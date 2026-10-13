import { SolverRequest, SolverResponse } from '../types/engine-types';

export interface ISolverClient {
  solveBaseline(request: SolverRequest): Promise<SolverResponse>;
}

export class ExternalMilpClient implements ISolverClient {
  private endpointUrl: string;

  constructor(endpointUrl: string) {
    this.endpointUrl = endpointUrl;
  }

  public async solveBaseline(request: SolverRequest): Promise<SolverResponse> {
    const response = await fetch(`${this.endpointUrl}/v1/solve`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Solver API Error: ${response.status} - ${response.statusText}`);
    }

    return await response.json();
  }
}

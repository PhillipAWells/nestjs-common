import { Injectable } from '@nestjs/common';
import { getErrorMessage } from '@pawells/nestjs-shared/common';

/**
 * Service for BSON serialization and deserialization
 * Wraps the bson npm package with lazy loading and error handling
 */
@Injectable()
export class BsonSerializationService {
	private BsonLib: any = null;
	private LoadPromise: Promise<any> | null = null;

	/**
	 * Check if bson package is available
	 */
	public IsAvailable(): boolean {
		// Use the cached bson instance if available
		// If getBson() has already been called and succeeded, the module is cached
		return this.BsonLib !== null;
	}

	/**
	 * Lazy load the bson library
	 */
	// eslint-disable-next-line require-await
	private async GetBson(): Promise<any> {
		if (this.BsonLib) {
			return this.BsonLib;
		}

		if (this.LoadPromise) {
			return this.LoadPromise;
		}

		this.LoadPromise = (async () => {
			try {
				// Dynamic import to load bson
				const Bson = await import('bson');
				this.BsonLib = Bson;
				return Bson;
			} catch (error) {
				throw new Error(
					'BSON package is not installed. Please install it with: npm install bson or yarn add bson',
					{ cause: error },
				);
			}
		})();

		return this.LoadPromise;
	}

	/**
	 * Serialize data to BSON buffer
	 * @param data The data to serialize
	 * @returns BSON buffer
	 * @throws Error if bson is not available or serialization fails
	 */
	public async serialize(data: unknown): Promise<Buffer> {
		try {
			const Bson = await this.GetBson();
			// Use BSON.serialize to convert object to buffer
			return Buffer.from(Bson.serialize(data));
		} catch (error) {
			throw new Error(
				`Failed to serialize to BSON: ${getErrorMessage(error)}`,
				{ cause: error },
			);
		}
	}

	/**
	 * Deserialize BSON buffer to data
	 * @param buffer The BSON buffer to deserialize
	 * @returns Deserialized data
	 * @throws Error if bson is not available or deserialization fails
	 */
	public async Deserialize(buffer: Buffer): Promise<unknown> {
		try {
			const Bson = await this.GetBson();
			// Use BSON.deserialize to convert buffer back to object
			return Bson.deserialize(buffer);
		} catch (error) {
			throw new Error(
				`Failed to deserialize BSON: ${getErrorMessage(error)}`,
				{ cause: error },
			);
		}
	}
}

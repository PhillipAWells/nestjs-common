import { Controller, Get, Post, Delete, Body, Query, Param, BadRequestException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Auth, Public, CurrentUser } from '@pawells/nestjs-auth';
import { ItemsService, type Item, type StoredItem } from './items.service.js';

const DEFAULT_LIMIT = 10;

/**
 * Minimal representation of an authenticated user injected via @CurrentUser().
 * In production this comes from the JWT payload resolved by userLookupFn.
 */
interface AppUser {
	id: string;
	email: string;
	roles: string[];
}

/**
 * ItemsController — REST API for vector-based item search and management.
 *
 * Demonstrates:
 *  - @Auth    — require a valid JWT on a route (@pawells/nestjs-auth)
 *  - @Public  — opt a route out of the global auth guard
 *  - @CurrentUser — inject the resolved user from the JWT payload
 */
@Controller('items')
export class ItemsController {
	private readonly moduleRef: ModuleRef;

	constructor(moduleRef: ModuleRef) {
		this.moduleRef = moduleRef;
	}

	private get items(): ItemsService {
		return this.moduleRef.get(ItemsService) as ItemsService;
	}

	/**
	 * POST /items
	 * Upsert an item with its embedding vector. Requires authentication.
	 */
	@Post()
	@Auth()
	public async upsertItem(
		@Body() body: StoredItem,
		@CurrentUser() _user: AppUser,
	): Promise<void> {
		await this.items.upsertItem(body);
	}

	/**
	 * GET /items/similar?vector=0.1,0.2,0.3&limit=5
	 * Find the nearest items for a query vector. Public — no auth required.
	 *
	 * This method validates parameters synchronously before returning the promise,
	 * so it does not need to be async.
	 */
	@Get('similar')
	@Public()
	// eslint-disable-next-line @typescript-eslint/promise-function-async
	public findSimilar(
		@Query('vector') vectorStr: string,
		@Query('limit') limitStr?: string,
	): Promise<Item[]> {
		if (!vectorStr) {
			throw new BadRequestException('vector query param is required');
		}

		const vector = vectorStr.split(',').map(Number);

		if (vector.some(n => !isFinite(n))) {
			throw new BadRequestException('vector must be a comma-separated list of numbers');
		}

		const limit = limitStr !== undefined ? Number(limitStr) : DEFAULT_LIMIT;
		return this.items.findSimilar(vector, limit);
	}

	/**
	 * DELETE /items/:id
	 * Remove an item by id. Requires authentication.
	 */
	@Delete(':id')
	@Auth()
	public async deleteItem(
		@Param('id') id: string,
		@CurrentUser() _user: AppUser,
	): Promise<void> {
		await this.items.deleteItem(id);
	}
}

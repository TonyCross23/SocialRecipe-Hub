import type { Request, Response } from 'express';
import {
  createCommentDto,
  createPostDto,
  postCommentParamsDto,
  postIdParamsDto,
  postPaginationDto,
} from '../dto/post.dto.js';
import type { PostUseCases } from '../use-cases/post.use-cases.js';

export class PostController {
  constructor(private readonly posts: PostUseCases) {}

  create = async (request: Request, response: Response) => {
    const input = createPostDto.parse(request.body);
    const post = await this.posts.createPost(response.locals.actor!.user.id, input);
    response.status(201).json({ post });
  };

  feed = async (request: Request, response: Response) => {
    const { page, limit } = postPaginationDto.parse(request.query);
    const result = await this.posts.getFeed(response.locals.actor!.user.id, page, limit);
    response.json(result);
  };

  createComment = async (request: Request, response: Response) => {
    const { postId } = postIdParamsDto.parse(request.params);
    const { content, parentId = null } = createCommentDto.parse(request.body);
    const comment = await this.posts.createComment(
      response.locals.actor!.user.id,
      postId,
      content,
      parentId,
    );
    response.status(201).json({ comment });
  };

  comments = async (request: Request, response: Response) => {
    const { postId } = postIdParamsDto.parse(request.params);
    const { page, limit } = postPaginationDto.parse(request.query);
    const result = await this.posts.getComments(
      response.locals.actor!.user.id,
      postId,
      page,
      limit,
    );
    response.json(result);
  };

  likePost = async (request: Request, response: Response) => {
    const { postId } = postIdParamsDto.parse(request.params);
    response.json(await this.posts.likePost(response.locals.actor!.user.id, postId));
  };

  unlikePost = async (request: Request, response: Response) => {
    const { postId } = postIdParamsDto.parse(request.params);
    response.json(await this.posts.unlikePost(response.locals.actor!.user.id, postId));
  };

  likeComment = async (request: Request, response: Response) => {
    const { postId, commentId } = postCommentParamsDto.parse(request.params);
    response.json(await this.posts.likeComment(response.locals.actor!.user.id, postId, commentId));
  };

  unlikeComment = async (request: Request, response: Response) => {
    const { postId, commentId } = postCommentParamsDto.parse(request.params);
    response.json(
      await this.posts.unlikeComment(response.locals.actor!.user.id, postId, commentId),
    );
  };

  share = async (request: Request, response: Response) => {
    const { postId } = postIdParamsDto.parse(request.params);
    response.json(await this.posts.share(postId));
  };
}
